"""Store settings: announcement text (top bar)

Revision ID: 9d41f7c2a0b3
Revises: b3f7c2a91d45
Create Date: 2026-09-21 21:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9d41f7c2a0b3'
down_revision: Union[str, Sequence[str], None] = 'b3f7c2a91d45'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'store_settings',
        sa.Column(
            'announcement_text',
            sa.String(length=200),
            server_default='ارسال رایگان برای خریدهای بالای ۱ میلیون تومان',
            nullable=False,
        ),
    )


def downgrade() -> None:
    op.drop_column('store_settings', 'announcement_text')