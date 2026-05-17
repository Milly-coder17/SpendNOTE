from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta
from home.models import Profile, Expense


class Command(BaseCommand):
    help = 'Reset weekly expenses for users whose week has passed. Keeps wishlists and notes.'

    def handle(self, *args, **options):
        now = timezone.now()
        week_ago = now - timedelta(days=7)
        
        # Get all profiles that need to be reset (last_reset was more than 7 days ago)
        profiles_to_reset = Profile.objects.filter(last_reset__lte=week_ago)
        
        reset_count = 0
        for profile in profiles_to_reset:
            # Delete all expenses for this user
            user_expenses = Expense.objects.filter(user=profile.user)
            expense_count = user_expenses.count()
            user_expenses.delete()
            
            # Update last_reset timestamp
            profile.last_reset = now
            profile.save()
            
            reset_count += 1
            self.stdout.write(
                self.style.SUCCESS(
                    f'Reset {expense_count} expenses for user {profile.user.username}'
                )
            )
        
        self.stdout.write(
            self.style.SUCCESS(
                f'Successfully reset {reset_count} user profiles'
            )
        )
