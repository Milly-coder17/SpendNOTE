from django.urls import path
from . import views

urlpatterns = [
    path('', views.index, name='login'),
    path('signup/', views.signup, name='signup'),
    path('dashboard/', views.dashboard, name='dashboard'),
    path('logout/', views.logout_view, name='logout'),
    path('add-expense/', views.add_expense, name='add_expense'),
    path('dashboard-data/', views.dashboard_data, name='dashboard_data'),
    path('update-budget/', views.update_budget, name='update_budget'),
    path('update-goal/', views.update_goal, name='update_goal'),
]