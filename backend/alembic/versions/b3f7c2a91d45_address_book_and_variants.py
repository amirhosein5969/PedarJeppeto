"""Address book + order item variants

Revision ID: b3f7c2a91d45
Revises: 7c1b4e9d2a53
Create Date: 2026-09-19 09:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b3f7c2a91d45'
down_revision: Union[str, Sequence[str], None] = '7c1b4e9d2a53'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # (1) New address-book table. A user keeps many named addresses; at most
    #     one is the default (enforced in the app layer).
    op.create_table(
        'user_addresses',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(length=80), nullable=False, server_default='آدرس'),
        sa.Column('province', sa.String(length=100), nullable=True),
        sa.Column('city', sa.String(length=100), nullable=True),
        sa.Column('zip_code', sa.String(length=20), nullable=True),
        sa.Column('address', sa.String(length=300), nullable=True),
        sa.Column('is_default', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column(
            'created_at',
            sa.DateTime(timezone=True),
            server_default=sa.text('now()'),
            nullable=False,
        ),
        sa.Column(
            'updated_at',
            sa.DateTime(timezone=True),
            server_default=sa.text('now()'),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_user_addresses_user_id'), 'user_addresses', ['user_id'], unique=False)

    # (2) Data migration: each user's flat checkout address (province/city/
    #     zip_code/address) becomes their default address row. Users with no
    #     address yet are skipped (nothing to migrate).
    op.execute(
        """
        INSERT INTO user_addresses (user_id, title, province, city, zip_code, address, is_default, created_at, updated_at)
        SELECT u.id, 'آدرس اصلی', u.province, u.city, u.zip_code, u.address, true, now(), now()
        FROM users u
        WHERE u.province IS NOT NULL
           OR u.city IS NOT NULL
           OR u.zip_code IS NOT NULL
           OR u.address IS NOT NULL
        """
    )

    # (3) Drop the now-redundant flat address columns from users.
    op.drop_column('users', 'address')
    op.drop_column('users', 'zip_code')
    op.drop_column('users', 'city')
    op.drop_column('users', 'province')

    # (4) Product-variant snapshots on order lines (wood type + color).
    op.add_column('order_items', sa.Column('wood_type', sa.String(length=120), nullable=True))
    op.add_column('order_items', sa.Column('color', sa.String(length=120), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('order_items', 'color')
    op.drop_column('order_items', 'wood_type')

    op.add_column('users', sa.Column('province', sa.String(length=100), nullable=True))
    op.add_column('users', sa.Column('city', sa.String(length=100), nullable=True))
    op.add_column('users', sa.Column('zip_code', sa.String(length=20), nullable=True))
    op.add_column('users', sa.Column('address', sa.String(length=300), nullable=True))

    # Restore each user's flat address from their default address row (if any).
    op.execute(
        """
        UPDATE users u
        SET province = a.province,
            city = a.city,
            zip_code = a.zip_code,
            address = a.address
        FROM user_addresses a
        WHERE a.user_id = u.id AND a.is_default
        """
    )

    op.drop_index(op.f('ix_user_addresses_user_id'), table_name='user_addresses')
    op.drop_table('user_addresses')