#!/usr/bin/env python3
import os
import sys

# ensure project root is on path
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'spendnote.settings')
import django
django.setup()

from django.contrib.auth.models import User
from django.db import transaction
from home.models import Expense, WishlistItem, Profile

with transaction.atomic():
    u_count = User.objects.count()
    e_count = Expense.objects.count()
    w_count = WishlistItem.objects.count()
    p_count = Profile.objects.count()

    print(f"About to delete: users={u_count}, expenses={e_count}, wishlists={w_count}, profiles={p_count}")

    Expense.objects.all().delete()
    WishlistItem.objects.all().delete()
    Profile.objects.all().delete()
    User.objects.all().delete()

    print("Deletion complete.")
