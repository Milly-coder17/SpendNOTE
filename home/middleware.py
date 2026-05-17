from django.utils import timezone
from datetime import timedelta
from home.models import Expense, Profile


class WeeklyResetMiddleware:
    """
    Middleware to automatically reset user expenses after a week.
    Keeps wishlists and notes intact.
    """
    
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # Only process authenticated users
        if request.user.is_authenticated:
            try:
                profile = Profile.objects.get(user=request.user)
                now = timezone.now()
                week_ago = now - timedelta(days=7)
                
                # Check if user's last reset was more than 7 days ago
                if profile.last_reset <= week_ago:
                    # Delete all expenses for this user
                    Expense.objects.filter(user=request.user).delete()
                    
                    # Update last reset timestamp
                    profile.last_reset = now
                    profile.save()
            except Profile.DoesNotExist:
                pass

        response = self.get_response(request)
        return response
