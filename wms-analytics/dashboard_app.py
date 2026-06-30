"""
WMS Analytics - Interactive Dashboard
=====================================
Web-based visualization dashboard running on localhost

Run with: streamlit run dashboard_app.py

Author: WMS Analytics Team
Date: January 2026
"""

import pandas as pd
import numpy as np
import plotly.graph_objects as go
import plotly.express as px
from plotly.subplots import make_subplots
import streamlit as st

# Page configuration
st.set_page_config(
    page_title="WMS Analytics Dashboard",
    page_icon="📊",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Custom CSS for better styling
st.markdown("""
    <style>
    .main {
        padding: 0rem 1rem;
    }
    div[data-testid="stMetricValue"] {
        font-size: 28px;
        color: #1f1f1f;
        font-weight: 600;
    }
    div[data-testid="stMetricLabel"] {
        font-size: 16px;
        color: #262730;
        font-weight: 500;
    }
    div[data-testid="stMetricDelta"] {
        font-size: 14px;
    }
    .stMetric {
        background-color: #ffffff;
        padding: 20px;
        border-radius: 10px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        border: 1px solid #e0e0e0;
    }
    .metric-row {
        background-color: #ffffff;
        padding: 20px;
        border-radius: 10px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        margin-top: 20px;
    }
    </style>
""", unsafe_allow_html=True)

# Title
st.title("Warehouse Management System - Analytics Dashboard")
st.markdown("---")

# Sidebar navigation
st.sidebar.title("Navigation")
page = st.sidebar.radio(
    "Select Analysis",
    ["Grain Movement Analysis", "Customer Activity & Sales"]
)

st.sidebar.markdown("---")

# Date Filter Section
st.sidebar.title("Date Filters")
filter_type = st.sidebar.selectbox(
    "Filter By:",
    ["All Time", "Financial Year", "Specific Month", "Custom Date Range"]
)

# Initialize filter variables
start_date = None
end_date = None

if filter_type == "Financial Year":
    financial_year = st.sidebar.selectbox(
        "Select Financial Year:",
        ["2023-2024", "2024-2025", "2025-2026"]
    )
    if financial_year == "2023-2024":
        start_date = pd.to_datetime("2023-04-01")
        end_date = pd.to_datetime("2024-03-31")
    elif financial_year == "2024-2025":
        start_date = pd.to_datetime("2024-04-01")
        end_date = pd.to_datetime("2025-03-31")
    else:  # 2025-2026
        start_date = pd.to_datetime("2025-04-01")
        end_date = pd.to_datetime("2026-03-31")
    
    st.sidebar.info(f"📊 Showing data from {start_date.strftime('%B %d, %Y')} to {end_date.strftime('%B %d, %Y')}")

elif filter_type == "Specific Month":
    col1, col2 = st.sidebar.columns(2)
    with col1:
        selected_month = st.selectbox(
            "Month:",
            ["January", "February", "March", "April", "May", "June", 
             "July", "August", "September", "October", "November", "December"]
        )
    with col2:
        selected_year = st.selectbox(
            "Year:",
            ["2023", "2024", "2025", "2026"]
        )
    
    month_num = ["January", "February", "March", "April", "May", "June", 
                 "July", "August", "September", "October", "November", "December"].index(selected_month) + 1
    
    start_date = pd.to_datetime(f"{selected_year}-{month_num:02d}-01")
    # Get last day of month
    if month_num == 12:
        end_date = pd.to_datetime(f"{int(selected_year)+1}-01-01") - pd.Timedelta(days=1)
    else:
        end_date = pd.to_datetime(f"{selected_year}-{month_num+1:02d}-01") - pd.Timedelta(days=1)
    
    st.sidebar.info(f"Showing data for {selected_month} {selected_year}")

elif filter_type == "Custom Date Range":
    col1, col2 = st.sidebar.columns(2)
    with col1:
        start_date = st.date_input("Start Date:", pd.to_datetime("2023-01-01"))
    with col2:
        end_date = st.date_input("End Date:", pd.to_datetime("2026-12-31"))
    
    start_date = pd.to_datetime(start_date)
    end_date = pd.to_datetime(end_date)
    
    st.sidebar.info(f"Showing data from {start_date.strftime('%B %d, %Y')} to {end_date.strftime('%B %d, %Y')}")

else:  # All Time
    st.sidebar.info("Showing all available data")

st.sidebar.markdown("---")
st.sidebar.info("**Tip:** Use date filters to analyze specific time periods.")

# Load data
@st.cache_data
def load_data():
    grain_movements = pd.read_csv('GRAIN_MOVEMENTS.csv')
    customer_activities = pd.read_csv('CUSTOMER_ACTIVITIES.csv')
    
    # Convert dates
    grain_movements['transaction_date'] = pd.to_datetime(grain_movements['transaction_date'])
    customer_activities['storage_start_date'] = pd.to_datetime(customer_activities['storage_start_date'])
    
    return grain_movements, customer_activities

try:
    grain_movements, customer_activities = load_data()
    
    # Apply date filters
    if start_date is not None and end_date is not None:
        grain_movements = grain_movements[
            (grain_movements['transaction_date'] >= start_date) & 
            (grain_movements['transaction_date'] <= end_date)
        ]
        customer_activities = customer_activities[
            (customer_activities['storage_start_date'] >= start_date) & 
            (customer_activities['storage_start_date'] <= end_date)
        ]
        
        # Display filter badge
        if len(grain_movements) == 0:
            st.warning(f"No data found for the selected period: {start_date.strftime('%B %d, %Y')} to {end_date.strftime('%B %d, %Y')}")
        else:
            st.success(f"Filtered Data: {len(grain_movements)} grain movement records | {len(customer_activities)} customer activity records")
    
    # ============================================================================
    # PAGE 1: GRAIN MOVEMENT ANALYSIS
    # ============================================================================
    if page == "Grain Movement Analysis":
        st.header("Grain Movement Analysis")
        if filter_type != "All Time":
            st.markdown(f"**Period:** {start_date.strftime('%B %d, %Y')} to {end_date.strftime('%B %d, %Y')}")
        st.markdown("Analysis of grain IN/OUT operations, trends, and inventory status")
        st.markdown("---")
        
        # Prepare data
        operation_summary = grain_movements.groupby('operation').agg({
            'total_weight_kg': 'sum',
            'number_of_bags': 'sum'
        }).reset_index()
        
        grain_type_summary = grain_movements.groupby(['grain_type', 'operation']).agg({
            'total_weight_kg': 'sum'
        }).reset_index()
        
        # Monthly trend
        grain_movements['month'] = grain_movements['transaction_date'].dt.to_period('M').astype(str)
        monthly_trend = grain_movements.groupby(['month', 'operation']).agg({
            'total_weight_kg': 'sum'
        }).reset_index()
        
        # Create 2x2 subplot layout
        fig = make_subplots(
            rows=2, cols=2,
            subplot_titles=(
                "Total Grain IN vs OUT (Tons)",
                "Grain Type Distribution by Operation",
                "Monthly Movement Trend",
                "Total Bags Moved"
            ),
            specs=[[{"type": "bar"}, {"type": "bar"}],
                   [{"type": "bar"}, {"type": "bar"}]]
        )
        
        # Chart 1: Total IN vs OUT
        total_in = operation_summary[operation_summary['operation'] == 'IN']['total_weight_kg'].sum() / 1000
        total_out = operation_summary[operation_summary['operation'] == 'OUT']['total_weight_kg'].sum() / 1000
        
        fig.add_trace(
            go.Bar(
                x=['IN', 'OUT'],
                y=[total_in, total_out],
                marker_color=['#2ecc71', '#e74c3c'],
                text=[f'{total_in:.2f}', f'{total_out:.2f}'],
                textposition='outside',
                showlegend=False
            ),
            row=1, col=1
        )
        
        # Chart 2: Grain type distribution
        grain_type_pivot = grain_type_summary.pivot(index='grain_type', columns='operation', values='total_weight_kg').fillna(0) / 1000
        
        for operation in ['IN', 'OUT']:
            if operation in grain_type_pivot.columns:
                fig.add_trace(
                    go.Bar(
                        x=grain_type_pivot.index,
                        y=grain_type_pivot[operation],
                        name=operation,
                        marker_color='#2ecc71' if operation == 'IN' else '#e74c3c'
                    ),
                    row=1, col=2
                )
        
        # Chart 3: Monthly trend
        monthly_pivot = monthly_trend.pivot(index='month', columns='operation', values='total_weight_kg').fillna(0) / 1000
        
        for operation in ['IN', 'OUT']:
            if operation in monthly_pivot.columns:
                fig.add_trace(
                    go.Bar(
                        x=monthly_pivot.index,
                        y=monthly_pivot[operation],
                        name=operation,
                        marker_color='#2ecc71' if operation == 'IN' else '#e74c3c',
                        showlegend=False
                    ),
                    row=2, col=1
                )
        
        # Chart 4: Total bags
        bags_in = operation_summary[operation_summary['operation'] == 'IN']['number_of_bags'].sum()
        bags_out = operation_summary[operation_summary['operation'] == 'OUT']['number_of_bags'].sum()
        
        fig.add_trace(
            go.Bar(
                x=['IN', 'OUT'],
                y=[bags_in, bags_out],
                marker_color=['#2ecc71', '#e74c3c'],
                text=[f'{bags_in:,}', f'{bags_out:,}'],
                textposition='outside',
                showlegend=False
            ),
            row=2, col=2
        )
        
        # Update layout
        fig.update_xaxes(title_text="Operation", row=1, col=1)
        fig.update_yaxes(title_text="Weight (Tons)", row=1, col=1)
        
        fig.update_xaxes(title_text="Grain Type", row=1, col=2)
        fig.update_yaxes(title_text="Weight (Tons)", row=1, col=2)
        
        fig.update_xaxes(title_text="Month", row=2, col=1)
        fig.update_yaxes(title_text="Weight (Tons)", row=2, col=1)
        
        fig.update_xaxes(title_text="Operation", row=2, col=2)
        fig.update_yaxes(title_text="Number of Bags", row=2, col=2)
        
        fig.update_layout(
            height=800,
            showlegend=True,
            title_text="Grain Movement Dashboard",
            title_font_size=20
        )
        
        # Display chart
        st.plotly_chart(fig, use_container_width=True)
        
        # Summary Statistics below chart
        st.markdown("---")
        st.subheader("GRAIN MOVEMENT SUMMARY")
        
        col1, col2, col3 = st.columns(3)
        
        net_storage = total_in - total_out
        
        with col1:
            st.markdown("### Total Grains IN")
            st.metric(
                label="Total Grains IN",
                value=f"{total_in:,.2f} Tons",
                delta=None,
                label_visibility="collapsed"
            )
        
        with col2:
            st.markdown("### Total Grains OUT")
            st.metric(
                label="Total Grains OUT",
                value=f"{total_out:,.2f} Tons",
                delta=None,
                label_visibility="collapsed"
            )
        
        with col3:
            st.markdown("### Net Storage")
            st.metric(
                label="Net Storage",
                value=f"{net_storage:,.2f} Tons",
                delta=f"↑ {net_storage:,.2f} Tons" if net_storage > 0 else None,
                delta_color="normal",
                label_visibility="collapsed"
            )
        
        # Additional stats in expandable section
        with st.expander("View Detailed Statistics"):
            col1, col2 = st.columns(2)
            
            with col1:
                st.markdown("**Movement by Grain Type:**")
                grain_type_totals = grain_movements.groupby('grain_type')['total_weight_kg'].sum().sort_values(ascending=False) / 1000
                for grain, weight in grain_type_totals.items():
                    st.write(f"- {grain}: {weight:,.2f} Tons")
            
            with col2:
                st.markdown("**Bags Summary:**")
                st.write(f"- Total Bags IN: {bags_in:,}")
                st.write(f"- Total Bags OUT: {bags_out:,}")
                st.write(f"- Net Bags in Storage: {bags_in - bags_out:,}")
    
    # ============================================================================
    # PAGE 2: CUSTOMER ACTIVITY & SALES
    # ============================================================================
    else:
        st.header("Customer Activity & Sales Analysis")
        if filter_type != "All Time":
            st.markdown(f"**Period:** {start_date.strftime('%B %d, %Y')} to {end_date.strftime('%B %d, %Y')}")
        st.markdown("Analysis of customer behavior, sales revenue, and profitability")
        st.markdown("---")
        
        # Prepare data
        activity_counts = customer_activities['activity_status'].value_counts()
        
        # Sales by grain type
        sales_by_grain = customer_activities.groupby('grain_type').agg({
            'total_sale_amount': 'sum',
            'sale_price_per_kg': 'mean',
            'profit_loss': 'sum'
        }).reset_index()
        
        # Profit/loss by status
        profit_by_status = customer_activities.groupby('activity_status')['profit_loss'].sum().reset_index()
        
        # Create 2x2 subplot layout
        fig = make_subplots(
            rows=2, cols=2,
            subplot_titles=(
                "Customer Count by Activity Status",
                "Total Sales Revenue by Grain Type",
                "Average Sale Price per KG",
                "Net Profit/Loss by Activity Status"
            ),
            specs=[[{"type": "bar"}, {"type": "bar"}],
                   [{"type": "bar"}, {"type": "bar"}]]
        )
        
        # Chart 1: Customer count
        fig.add_trace(
            go.Bar(
                x=activity_counts.index,
                y=activity_counts.values,
                marker_color=['#3498db', '#9b59b6', '#e67e22'],
                text=activity_counts.values,
                textposition='outside',
                showlegend=False
            ),
            row=1, col=1
        )
        
        # Chart 2: Sales revenue
        fig.add_trace(
            go.Bar(
                x=sales_by_grain['grain_type'],
                y=sales_by_grain['total_sale_amount'] / 1000,
                marker_color='#27ae60',
                text=[f'₹{val/1000:.0f}K' for val in sales_by_grain['total_sale_amount']],
                textposition='outside',
                showlegend=False
            ),
            row=1, col=2
        )
        
        # Chart 3: Average price
        fig.add_trace(
            go.Bar(
                x=sales_by_grain['grain_type'],
                y=sales_by_grain['sale_price_per_kg'],
                marker_color='#f39c12',
                text=[f'₹{val:.2f}' for val in sales_by_grain['sale_price_per_kg']],
                textposition='outside',
                showlegend=False
            ),
            row=2, col=1
        )
        
        # Chart 4: Profit/loss
        colors = ['#27ae60' if val > 0 else '#e74c3c' for val in profit_by_status['profit_loss']]
        fig.add_trace(
            go.Bar(
                x=profit_by_status['activity_status'],
                y=profit_by_status['profit_loss'] / 1000,
                marker_color=colors,
                text=[f'₹{val/1000:.0f}K' for val in profit_by_status['profit_loss']],
                textposition='outside',
                showlegend=False
            ),
            row=2, col=2
        )
        
        # Update layout
        fig.update_xaxes(title_text="Activity Status", row=1, col=1)
        fig.update_yaxes(title_text="Number of Customers", row=1, col=1)
        
        fig.update_xaxes(title_text="Grain Type", row=1, col=2)
        fig.update_yaxes(title_text="Revenue (₹ Thousands)", row=1, col=2)
        
        fig.update_xaxes(title_text="Grain Type", row=2, col=1)
        fig.update_yaxes(title_text="Price (₹/kg)", row=2, col=1)
        
        fig.update_xaxes(title_text="Activity Status", row=2, col=2)
        fig.update_yaxes(title_text="Profit/Loss (₹ Thousands)", row=2, col=2)
        
        fig.update_layout(
            height=800,
            showlegend=False,
            title_text="Customer Activity & Sales Dashboard",
            title_font_size=20
        )
        
        # Display chart
        st.plotly_chart(fig, width='stretch')
        
        # Summary Statistics below chart
        st.markdown("---")
        st.subheader("CUSTOMER ACTIVITY SUMMARY")
        
        col1, col2, col3 = st.columns(3)
        
        storing_count = activity_counts.get('storing', 0)
        stored_count = activity_counts.get('stored', 0)
        sold_count = activity_counts.get('sold', 0)
        
        with col1:
            st.markdown("### Currently Storing")
            st.metric(
                label="",
                value=f"{storing_count:,} customers",
                delta=None,
                label_visibility="collapsed"
            )
        
        with col2:
            st.markdown("### Historical Storage")
            st.metric(
                label="",
                value=f"{stored_count:,} customers",
                delta=None,
                label_visibility="collapsed"
            )
        
        with col3:
            st.markdown("### Sold Grains")
            st.metric(
                label="",
                value=f"{sold_count:,} customers",
                delta=None,
                label_visibility="collapsed"
            )
        
        st.markdown("---")
        st.subheader("FINANCIAL SUMMARY")
        
        col1, col2, col3 = st.columns(3)
        
        total_sales = customer_activities['total_sale_amount'].sum()
        total_rent = customer_activities['total_rent_paid'].sum()
        total_profit = customer_activities['profit_loss'].sum()
        
        with col1:
            st.markdown("### Total Sales Revenue")
            st.metric(
                label="",
                value=f"₹{total_sales:,.0f}",
                delta=None,
                label_visibility="collapsed"
            )
        
        with col2:
            st.markdown("### Total Rent Collected")
            st.metric(
                label="",
                value=f"₹{total_rent:,.2f}",
                delta=None,
                label_visibility="collapsed"
            )
        
        with col3:
            st.markdown("### Net Profit/Loss")
            st.metric(
                label="",
                value=f"₹{total_profit:,.2f}",
                delta=f"↑ ₹{total_profit:,.2f}" if total_profit > 0 else None,
                delta_color="normal" if total_profit > 0 else "inverse",
                label_visibility="collapsed"
            )
        
        # Additional stats in expandable section
        with st.expander("View Detailed Statistics"):
            col1, col2 = st.columns(2)
            
            with col1:
                st.markdown("**Top Performing Grain Types:**")
                top_grains = sales_by_grain.nlargest(5, 'total_sale_amount')
                for _, row in top_grains.iterrows():
                    st.write(f"- {row['grain_type']}: ₹{row['total_sale_amount']:,.0f}")
            
            with col2:
                st.markdown("**Profitability by Grain:**")
                profit_grains = sales_by_grain.nlargest(5, 'profit_loss')
                for _, row in profit_grains.iterrows():
                    st.write(f"- {row['grain_type']}: ₹{row['profit_loss']:,.0f}")

except FileNotFoundError as e:
    st.error(f"Error: Could not find data files. Please ensure GRAIN_MOVEMENTS.csv and CUSTOMER_ACTIVITIES.csv are in the same directory.")
    st.info("Current working directory: " + os.getcwd())
except Exception as e:
    st.error(f"An error occurred: {str(e)}")
    st.exception(e)

# Footer
st.markdown("---")
st.markdown(
    """
    <div style='text-align: center; color: #666; padding: 20px;'>
        <p>📊 WMS Analytics Dashboard | Built with Streamlit & Plotly</p>
        <p>Last Updated: January 2026</p>
    </div>
    """,
    unsafe_allow_html=True
)
