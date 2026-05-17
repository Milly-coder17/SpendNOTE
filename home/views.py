from django.contrib.auth.models import User
from django.contrib.auth import authenticate, login, logout
from django.shortcuts import render, redirect
from django.http import JsonResponse
from .models import Expense, Profile, WishlistItem
from datetime import datetime
from decimal import Decimal, InvalidOperation
import json


def get_profile(user):
    profile, _ = Profile.objects.get_or_create(user=user)
    return profile


def get_wishlist_items(user):
    return WishlistItem.objects.filter(user=user).order_by('-created_at')


def index(request):
    if request.method == "POST":

        username = request.POST.get("username", "").strip()
        password = request.POST.get("password", "")

        print("LOGIN:", username, password)

        user = authenticate(request, username=username, password=password)

        print("AUTH RESULT:", user)

        if user is not None:
            login(request, user)
            return redirect("/dashboard/")

        return render(request, "index.html", {
            "error": "Invalid username or password"
        })

    return render(request, "index.html")

def signup(request):
    if request.method == "POST":

        username = request.POST.get("username", "").strip()
        email = request.POST.get("email", "")
        password = request.POST.get("password", "")

        if User.objects.filter(username=username).exists():
            return render(request, "signup.html", {"error": "User exists"})

        user = User.objects.create_user(
            username=username,
            email=email,
            password=password
        )

        user.set_password(password)
        user.save()

        Profile.objects.create(user=user)

        return redirect("/")

    return render(request, "signup.html")


def dashboard(request):
    if not request.user.is_authenticated:
        return redirect('/')

    expenses = Expense.objects.filter(user=request.user).order_by("-id")
    wishlists = get_wishlist_items(request.user)

    total_spent = sum(e.amount for e in expenses)
    profile = get_profile(request.user)

    return render(request, "home.html", {
        "expenses": expenses,
        "wishlists": wishlists,
        "total_spent": total_spent,
        "budget": profile.budget,
        "goal": profile.goal,
        "balance": profile.budget - total_spent
    })

def logout_view(request):

    logout(request)

    return redirect('/')

def add_expense(request):

    if request.method == "POST":

        if not request.user.is_authenticated:
            return JsonResponse({"error": "not logged in"}, status=403)

        try:
            data = json.loads(request.body)
        except json.JSONDecodeError:
            return JsonResponse({"error": "Invalid JSON"}, status=400)

        description = data.get("description")
        amount = data.get("amount")
        date_str = data.get("date")
        is_wishlist = data.get("is_wishlist", False)

        if not description or amount is None or not date_str:
            return JsonResponse({"error": "Description, amount, and date are required"}, status=400)

        try:
            amount = float(amount)
        except (TypeError, ValueError):
            return JsonResponse({"error": "Invalid amount"}, status=400)

        if isinstance(is_wishlist, str):
            is_wishlist = is_wishlist.lower() in ("true", "1", "yes", "on")

        try:
            date_value = datetime.strptime(date_str, "%Y-%m-%d").date()
        except (ValueError, TypeError):
            return JsonResponse({"error": "Invalid date format. Use YYYY-MM-DD."}, status=400)

        Expense.objects.create(
            user=request.user,
            description=description,
            amount=amount,
            date=date_value,
            is_wishlist=is_wishlist
        )

        expenses = Expense.objects.filter(user=request.user)
        total_spent = sum(e.amount for e in expenses)

        return JsonResponse({
            "message": "Expense saved",
            "total_spent": float(total_spent)
        })


def add_wishlist_item(request):
    if request.method != "POST":
        return JsonResponse({"error": "POST required"}, status=405)

    if not request.user.is_authenticated:
        return JsonResponse({"error": "not logged in"}, status=403)

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON"}, status=400)

    title = data.get("title")
    price = data.get("price")

    if not title:
        return JsonResponse({"error": "Title is required"}, status=400)

    if price is None or price == "":
        return JsonResponse({"error": "Price is required"}, status=400)

    try:
        price = Decimal(price)
    except (InvalidOperation, TypeError, ValueError):
        return JsonResponse({"error": "Invalid price"}, status=400)

    item = WishlistItem.objects.create(
        user=request.user,
        title=title,
        price=price
    )

    return JsonResponse({
        "message": "Wishlist item saved",
        "id": item.id,
        "title": item.title,
        "price": float(item.price) if item.price is not None else None,
        "is_bought": item.is_bought
    })


def mark_wishlist_bought(request):
    if request.method != "POST":
        return JsonResponse({"error": "POST required"}, status=405)

    if not request.user.is_authenticated:
        return JsonResponse({"error": "not logged in"}, status=403)

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON"}, status=400)

    item_id = data.get("id")
    if not item_id:
        return JsonResponse({"error": "Item id is required"}, status=400)

    try:
        item = WishlistItem.objects.get(id=item_id, user=request.user)
    except WishlistItem.DoesNotExist:
        return JsonResponse({"error": "Wishlist item not found"}, status=404)

    item.is_bought = True
    item.save()

    # If the wishlist item has a price, create amortized Expense records so the
    # purchase is reflected across all days in the database. This ensures the
    # dashboard data stays consistent after a page reload.
    if item.price is not None:
        try:
            # avoid creating duplicate wishlist expenses if already present
            existing = Expense.objects.filter(
                user=request.user,
                is_wishlist=True,
                description__startswith=f"Wishlist: {item.title}"
            ).exists()
            if not existing:
                price_val = float(item.price)
                per_day = price_val / 7.0
                today = datetime.now().date()
                from datetime import timedelta
                # mapping used by dashboard: key i -> weekday w = (i + 6) % 7
                for i in range(7):
                    w = (i + 6) % 7
                    offset = (w - today.weekday()) % 7
                    d = today + timedelta(days=offset)
                    Expense.objects.create(
                        user=request.user,
                        description=f"Wishlist: {item.title} - part {i+1}/7",
                        amount=per_day,
                        date=d,
                        is_wishlist=True
                    )
        except Exception:
            # If expense creation fails for any reason, continue but log.
            pass

    # Recompute dashboard data to return updated totals
    expenses = Expense.objects.filter(user=request.user)
    total_spent = sum(e.amount for e in expenses)
    profile = get_profile(request.user)

    daily_spent = {str(i): 0 for i in range(7)}
    for expense in expenses:
        day_of_week = str(expense.date.weekday())
        if day_of_week == '6':
            day_of_week = '0'
        elif day_of_week == '0':
            day_of_week = '1'
        elif day_of_week == '1':
            day_of_week = '2'
        elif day_of_week == '2':
            day_of_week = '3'
        elif day_of_week == '3':
            day_of_week = '4'
        elif day_of_week == '4':
            day_of_week = '5'
        elif day_of_week == '5':
            day_of_week = '6'
        daily_spent[day_of_week] = float(daily_spent[day_of_week]) + float(expense.amount)
    # Note: Expenses are now created amortized across days, so no additional
    # transformation of `daily_spent` is required here.
    return JsonResponse({
        "message": "Wishlist item marked bought",
        "id": item.id,
        "total_spent": float(total_spent),
        "budget": float(profile.budget),
        "goal": float(profile.goal),
        "balance": float(profile.budget) - float(total_spent),
        "daily_spent": daily_spent
    })


def dashboard_data(request):

    if not request.user.is_authenticated:
        return JsonResponse({"error": "not logged in"}, status=403)

    expenses = Expense.objects.filter(user=request.user)

    total_spent = sum(e.amount for e in expenses)
    profile = get_profile(request.user)
    
    daily_spent = {str(i): 0 for i in range(7)}
    for expense in expenses:
        day_of_week = str(expense.date.weekday())
        if day_of_week == '6':
            day_of_week = '0'
        elif day_of_week == '0':
            day_of_week = '1'
        elif day_of_week == '1':
            day_of_week = '2'
        elif day_of_week == '2':
            day_of_week = '3'
        elif day_of_week == '3':
            day_of_week = '4'
        elif day_of_week == '4':
            day_of_week = '5'
        elif day_of_week == '5':
            day_of_week = '6'
        daily_spent[day_of_week] = float(daily_spent[day_of_week]) + float(expense.amount)

    return JsonResponse({
        "total_spent": float(total_spent),
        "budget": float(profile.budget),
        "goal": float(profile.goal),
        "balance": float(profile.budget) - float(total_spent),
        "daily_spent": daily_spent
    })

def update_budget(request):
    if request.method == "POST":
        if not request.user.is_authenticated:
            return JsonResponse({"error": "not logged in"}, status=403)

        data = json.loads(request.body)
        budget = data.get("budget")

        profile = get_profile(request.user)
        profile.budget = budget
        profile.save()

        return JsonResponse({"message": "Budget updated"})

def update_goal(request):
    if request.method == "POST":
        if not request.user.is_authenticated:
            return JsonResponse({"error": "not logged in"}, status=403)

        data = json.loads(request.body)
        goal = data.get("goal")

        profile = get_profile(request.user)
        profile.goal = goal
        profile.save()

        return JsonResponse({"message": "Goal updated"})