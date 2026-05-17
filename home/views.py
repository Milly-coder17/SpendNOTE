from django.contrib.auth.models import User
from django.contrib.auth import authenticate, login, logout
from django.shortcuts import render, redirect
from django.http import JsonResponse
from .models import Expense, Profile
from datetime import datetime
import json


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

def get_profile(user):
    profile, _ = Profile.objects.get_or_create(user=user)
    return profile


def dashboard(request):
    if not request.user.is_authenticated:
        return redirect('/')

    expenses = Expense.objects.filter(user=request.user).order_by("-id")

    total_spent = sum(e.amount for e in expenses)
    profile = get_profile(request.user)

    return render(request, "home.html", {
        "expenses": expenses,
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

        if not description or amount is None or not date_str:
            return JsonResponse({"error": "Description, amount, and date are required"}, status=400)

        try:
            amount = float(amount)
        except (TypeError, ValueError):
            return JsonResponse({"error": "Invalid amount"}, status=400)

        try:
            date_value = datetime.strptime(date_str, "%Y-%m-%d").date()
        except (ValueError, TypeError):
            return JsonResponse({"error": "Invalid date format. Use YYYY-MM-DD."}, status=400)

        Expense.objects.create(
            user=request.user,
            description=description,
            amount=amount,
            date=date_value
        )

        expenses = Expense.objects.filter(user=request.user)
        total_spent = sum(e.amount for e in expenses)

        return JsonResponse({
            "message": "Expense saved",
            "total_spent": float(total_spent)
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