"""
WMS Analytics - Data Visualization
====================================
This script creates visualizations for warehouse management data analysis.

Required Visualizations:
1. Grain IN/OUT Movement Analysis (Bar Graph)
2. Customer Activity & Sales Analysis (Bar Graph)
"""

import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
import numpy as np
from datetime import datetime

# Set style
plt.style.use('seaborn-v0_8-darkgrid')
sns.set_palette("husl")

# Load datasets
print("Loading datasets...")
grain_movements = pd.read_csv('GRAIN_MOVEMENTS.csv')
customer_activities = pd.read_csv('CUSTOMER_ACTIVITIES.csv')

# Convert date columns
grain_movements['transaction_date'] = pd.to_datetime(grain_movements['transaction_date'])
customer_activities['storage_start_date'] = pd.to_datetime(customer_activities['storage_start_date'])
customer_activities['storage_end_date'] = pd.to_datetime(customer_activities['storage_end_date'], errors='coerce')
customer_activities['sale_date'] = pd.to_datetime(customer_activities['sale_date'], errors='coerce')

print(f"Grain Movements: {len(grain_movements)} records")
print(f"Customer Activities: {len(customer_activities)} records")
print("\n" + "="*80 + "\n")

# =============================================================================
# VISUALIZATION 1: Grain IN/OUT Movement Analysis
# =============================================================================
print("Creating Visualization 1: Grain IN/OUT Movement Analysis")

fig, axes = plt.subplots(2, 2, figsize=(16, 12))
fig.suptitle('Grain Movement Analysis - IN vs OUT Operations', fontsize=20, fontweight='bold', y=0.995)

# 1.1 Total IN vs OUT by Operation
ax1 = axes[0, 0]
operation_summary = grain_movements.groupby('operation')['total_weight_kg'].sum() / 1000  # Convert to tons
colors = ['#2ecc71', '#e74c3c']
bars1 = ax1.bar(operation_summary.index, operation_summary.values, color=colors, alpha=0.8, edgecolor='black', linewidth=1.5)
ax1.set_title('Total Grain Movement: IN vs OUT', fontsize=14, fontweight='bold', pad=15)
ax1.set_ylabel('Total Weight (Tons)', fontsize=12, fontweight='bold')
ax1.set_xlabel('Operation Type', fontsize=12, fontweight='bold')
ax1.grid(axis='y', alpha=0.3)
# Add value labels on bars
for bar in bars1:
    height = bar.get_height()
    ax1.text(bar.get_x() + bar.get_width()/2., height,
            f'{height:,.0f}',
            ha='center', va='bottom', fontsize=11, fontweight='bold')

# 1.2 Grain Type Distribution - IN vs OUT
ax2 = axes[0, 1]
grain_type_summary = grain_movements.groupby(['grain_type', 'operation'])['total_weight_kg'].sum().unstack(fill_value=0) / 1000
grain_type_summary.plot(kind='bar', ax=ax2, color=['#2ecc71', '#e74c3c'], alpha=0.8, edgecolor='black', linewidth=1.5, width=0.7)
ax2.set_title('Grain Movement by Type (IN vs OUT)', fontsize=14, fontweight='bold', pad=15)
ax2.set_ylabel('Total Weight (Tons)', fontsize=12, fontweight='bold')
ax2.set_xlabel('Grain Type', fontsize=12, fontweight='bold')
ax2.legend(['IN', 'OUT'], title='Operation', fontsize=10)
ax2.grid(axis='y', alpha=0.3)
ax2.set_xticklabels(ax2.get_xticklabels(), rotation=45, ha='right')

# 1.3 Monthly Trend - IN vs OUT
ax3 = axes[1, 0]
grain_movements['month'] = grain_movements['transaction_date'].dt.to_period('M')
monthly_trend = grain_movements.groupby(['month', 'operation'])['total_weight_kg'].sum().unstack(fill_value=0) / 1000
monthly_trend.plot(kind='bar', ax=ax3, color=['#2ecc71', '#e74c3c'], alpha=0.8, edgecolor='black', linewidth=1.5, width=0.7)
ax3.set_title('Monthly Grain Movement Trend', fontsize=14, fontweight='bold', pad=15)
ax3.set_ylabel('Total Weight (Tons)', fontsize=12, fontweight='bold')
ax3.set_xlabel('Month', fontsize=12, fontweight='bold')
ax3.legend(['IN', 'OUT'], title='Operation', fontsize=10)
ax3.grid(axis='y', alpha=0.3)
ax3.set_xticklabels([str(x) for x in monthly_trend.index], rotation=45, ha='right')

# 1.4 Number of Bags - IN vs OUT
ax4 = axes[1, 1]
bags_summary = grain_movements.groupby('operation')['number_of_bags'].sum()
colors_bags = ['#3498db', '#f39c12']
bars4 = ax4.bar(bags_summary.index, bags_summary.values, color=colors_bags, alpha=0.8, edgecolor='black', linewidth=1.5)
ax4.set_title('Total Bags Moved: IN vs OUT', fontsize=14, fontweight='bold', pad=15)
ax4.set_ylabel('Number of Bags', fontsize=12, fontweight='bold')
ax4.set_xlabel('Operation Type', fontsize=12, fontweight='bold')
ax4.grid(axis='y', alpha=0.3)
# Add value labels on bars
for bar in bars4:
    height = bar.get_height()
    ax4.text(bar.get_x() + bar.get_width()/2., height,
            f'{int(height):,}',
            ha='center', va='bottom', fontsize=11, fontweight='bold')

plt.tight_layout()
plt.savefig('grain_movement_analysis.png', dpi=300, bbox_inches='tight')
print("✓ Saved: grain_movement_analysis.png")
plt.show()

print("\n" + "="*80 + "\n")

# =============================================================================
# VISUALIZATION 2: Customer Activity & Sales Analysis
# =============================================================================
print("Creating Visualization 2: Customer Activity & Sales Analysis")

fig2, axes2 = plt.subplots(2, 2, figsize=(16, 12))
fig2.suptitle('Customer Activity & Sales Performance Analysis', fontsize=20, fontweight='bold', y=0.995)

# 2.1 Customer Count by Activity Status
ax1 = axes2[0, 0]
activity_counts = customer_activities['activity_status'].value_counts()
colors_activity = ['#9b59b6', '#3498db', '#e67e22']
bars_activity = ax1.bar(activity_counts.index, activity_counts.values, color=colors_activity, alpha=0.8, edgecolor='black', linewidth=1.5)
ax1.set_title('Customer Distribution by Activity Status', fontsize=14, fontweight='bold', pad=15)
ax1.set_ylabel('Number of Customers', fontsize=12, fontweight='bold')
ax1.set_xlabel('Activity Status', fontsize=12, fontweight='bold')
ax1.grid(axis='y', alpha=0.3)
# Add value labels
for bar in bars_activity:
    height = bar.get_height()
    ax1.text(bar.get_x() + bar.get_width()/2., height,
            f'{int(height)}',
            ha='center', va='bottom', fontsize=11, fontweight='bold')

# 2.2 Sales Analysis by Grain Type
ax2 = axes2[0, 1]
sold_customers = customer_activities[customer_activities['sold_status'] == 'yes']
sales_by_grain = sold_customers.groupby('grain_type')['total_sale_amount'].sum() / 1000  # Convert to thousands
bars_sales = ax2.bar(sales_by_grain.index, sales_by_grain.values, color='#27ae60', alpha=0.8, edgecolor='black', linewidth=1.5)
ax2.set_title('Total Sales Revenue by Grain Type', fontsize=14, fontweight='bold', pad=15)
ax2.set_ylabel('Revenue (₹ Thousands)', fontsize=12, fontweight='bold')
ax2.set_xlabel('Grain Type', fontsize=12, fontweight='bold')
ax2.grid(axis='y', alpha=0.3)
ax2.set_xticklabels(ax2.get_xticklabels(), rotation=45, ha='right')
# Add value labels
for bar in bars_sales:
    height = bar.get_height()
    if height > 0:
        ax2.text(bar.get_x() + bar.get_width()/2., height,
                f'₹{height:,.0f}K',
                ha='center', va='bottom', fontsize=10, fontweight='bold')

# 2.3 Average Sale Price per kg by Grain Type
ax3 = axes2[1, 0]
avg_prices = sold_customers[sold_customers['sale_price_per_kg'] > 0].groupby('grain_type')['sale_price_per_kg'].mean()
bars_price = ax3.bar(avg_prices.index, avg_prices.values, color='#e67e22', alpha=0.8, edgecolor='black', linewidth=1.5)
ax3.set_title('Average Sale Price per Kg by Grain Type', fontsize=14, fontweight='bold', pad=15)
ax3.set_ylabel('Price (₹ per Kg)', fontsize=12, fontweight='bold')
ax3.set_xlabel('Grain Type', fontsize=12, fontweight='bold')
ax3.grid(axis='y', alpha=0.3)
ax3.set_xticklabels(ax3.get_xticklabels(), rotation=45, ha='right')
# Add value labels
for bar in bars_price:
    height = bar.get_height()
    ax3.text(bar.get_x() + bar.get_width()/2., height,
            f'₹{height:.1f}',
            ha='center', va='bottom', fontsize=10, fontweight='bold')

# 2.4 Storage vs Sales - Profit Analysis
ax4 = axes2[1, 1]
profit_data = customer_activities[customer_activities['profit_loss'] != 0].groupby('activity_status')['profit_loss'].sum() / 1000
colors_profit = ['#c0392b' if x < 0 else '#27ae60' for x in profit_data.values]
bars_profit = ax4.bar(profit_data.index, profit_data.values, color=colors_profit, alpha=0.8, edgecolor='black', linewidth=1.5)
ax4.set_title('Net Profit/Loss by Activity Status', fontsize=14, fontweight='bold', pad=15)
ax4.set_ylabel('Profit/Loss (₹ Thousands)', fontsize=12, fontweight='bold')
ax4.set_xlabel('Activity Status', fontsize=12, fontweight='bold')
ax4.axhline(y=0, color='black', linestyle='-', linewidth=0.8)
ax4.grid(axis='y', alpha=0.3)
# Add value labels
for bar in bars_profit:
    height = bar.get_height()
    label = f'₹{abs(height):,.0f}K'
    if height < 0:
        label = f'-₹{abs(height):,.0f}K'
    ax4.text(bar.get_x() + bar.get_width()/2., height,
            label,
            ha='center', va='bottom' if height > 0 else 'top', fontsize=10, fontweight='bold')

plt.tight_layout()
plt.savefig('customer_sales_analysis.png', dpi=300, bbox_inches='tight')
print("✓ Saved: customer_sales_analysis.png")
plt.show()

print("\n" + "="*80 + "\n")

# =============================================================================
# Summary Statistics
# =============================================================================
print("SUMMARY STATISTICS")
print("=" * 80)
print("\n📊 GRAIN MOVEMENT SUMMARY:")
print(f"  Total Grains IN:  {grain_movements[grain_movements['operation']=='IN']['total_weight_kg'].sum()/1000:,.2f} Tons")
print(f"  Total Grains OUT: {grain_movements[grain_movements['operation']=='OUT']['total_weight_kg'].sum()/1000:,.2f} Tons")
print(f"  Net Storage:      {(grain_movements[grain_movements['operation']=='IN']['total_weight_kg'].sum() - grain_movements[grain_movements['operation']=='OUT']['total_weight_kg'].sum())/1000:,.2f} Tons")

print("\n👥 CUSTOMER ACTIVITY SUMMARY:")
print(f"  Currently Storing: {len(customer_activities[customer_activities['activity_status']=='storing'])} customers")
print(f"  Historical Storage: {len(customer_activities[customer_activities['activity_status']=='stored'])} customers")
print(f"  Sold Grains: {len(customer_activities[customer_activities['activity_status']=='sold'])} customers")

print("\n💰 SALES SUMMARY:")
total_sales = sold_customers[sold_customers['total_sale_amount'] > 0]['total_sale_amount'].sum()
total_rent = customer_activities['total_rent_paid'].sum()
net_profit = customer_activities['profit_loss'].sum()
print(f"  Total Sales Revenue: ₹{total_sales:,.2f}")
print(f"  Total Rent Collected: ₹{total_rent:,.2f}")
print(f"  Net Profit/Loss: ₹{net_profit:,.2f}")

print("\n" + "="*80)
print("✓ Visualization Complete!")
print("Generated Files:")
print("  - grain_movement_analysis.png")
print("  - customer_sales_analysis.png")
