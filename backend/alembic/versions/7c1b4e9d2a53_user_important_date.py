"""User important date

Revision ID: 7c1b4e9d2a53
Revises: 422319028cde
Create Date: 2026-09-18 18:45:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7c1b4e9d2a53'
down_revision: Union[str, Sequence[str], None] = '422319028cde'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Free-form important dates (birthdays / anniversaries) for gifting
    # reminders — edited from the customer portal (Phase 6).
    op.add_column('users', sa.Column('important_date', sa.String(length=120), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('users', 'important_date')