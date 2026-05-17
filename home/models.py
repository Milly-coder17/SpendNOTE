from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone


class Profile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    budget = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    goal = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    last_reset = models.DateTimeField(default=timezone.now)

    def __str__(self):
        return self.user.username


class WishlistItem(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    title = models.CharField(max_length=255)
    price = models.DecimalField(max_digits=10, decimal_places=2, help_text="Price is required for wishlist items")
    is_bought = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.title


class Expense(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    description = models.CharField(max_length=255)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    date = models.DateField()
    is_wishlist = models.BooleanField(default=False, help_text="True if this expense is a purchased wishlist item")

    def __str__(self):
        return self.description