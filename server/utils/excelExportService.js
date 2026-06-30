const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

class ExcelExportService {
    constructor() {
        this.exportsDir = './uploads/exports';
        this.ensureExportsDir();
    }

    ensureExportsDir() {
        if (!fs.existsSync(this.exportsDir)) {
            fs.mkdirSync(this.exportsDir, { recursive: true });
        }
    }

    // Export transactions to Excel
    async exportTransactions(transactions) {
        try {
            const workbook = XLSX.utils.book_new();
            
            // Prepare transaction data
            const transactionData = transactions.map((transaction, index) => ({
                'S.No': index + 1,
                'Receipt Number': transaction.receiptNumber || 'N/A',
                'Date': new Date(transaction.createdAt).toLocaleDateString('en-IN'),
                'Customer Name': transaction.customer?.name || 'N/A',
                'Vehicle Number': transaction.vehicle?.vehicleNumber || 'N/A',
                'Vehicle Type': transaction.vehicle?.vehicleType || 'N/A',
                'Driver Name': transaction.vehicle?.driverName || 'N/A',
                'Driver Phone': transaction.vehicle?.driverPhone || 'N/A',
                'Type': transaction.type || 'N/A',
                'Amount': `₹${transaction.payment?.amount || 0}`,
                'Payment Status': transaction.payment?.status || 'pending',
                'Payment Method': transaction.payment?.method || 'N/A',
                'Description': transaction.description || 'N/A'
            }));

            const worksheet = XLSX.utils.json_to_sheet(transactionData);
            
            // Set column widths
            worksheet['!cols'] = [
                { width: 8 },  // S.No
                { width: 20 }, // Receipt Number
                { width: 15 }, // Date
                { width: 25 }, // Customer Name
                { width: 20 }, // Vehicle Number
                { width: 15 }, // Vehicle Type
                { width: 25 }, // Driver Name
                { width: 15 }, // Driver Phone
                { width: 15 }, // Type
                { width: 12 }, // Amount
                { width: 15 }, // Payment Status
                { width: 15 }, // Payment Method
                { width: 30 }  // Description
            ];

            XLSX.utils.book_append_sheet(workbook, worksheet, 'Transactions');

            const filename = `transactions_${new Date().toISOString().split('T')[0]}_${Date.now()}.xlsx`;
            const filepath = path.join(this.exportsDir, filename);

            XLSX.writeFile(workbook, filepath);

            return {
                success: true,
                filename,
                filepath,
                url: `/uploads/exports/${filename}`,
                recordCount: transactions.length
            };
        } catch (error) {
            console.error('Transaction export error:', error);
            throw error;
        }
    }

    // Export customers to Excel
    async exportCustomers(customers) {
        try {
            const workbook = XLSX.utils.book_new();
            
            const customerData = customers.map((customer, index) => ({
                'S.No': index + 1,
                'Name': customer.name || 'N/A',
                'Email': customer.email || 'N/A',
                'Phone': customer.phone || 'N/A',
                'Address': customer.address || 'N/A',
                'Company': customer.company || 'N/A',
                'Registration Date': new Date(customer.createdAt).toLocaleDateString('en-IN'),
                'Status': customer.status || 'active',
                'Total Transactions': customer.totalTransactions || 0,
                'Total Spent': `₹${customer.totalSpent || 0}`
            }));

            const worksheet = XLSX.utils.json_to_sheet(customerData);
            
            worksheet['!cols'] = [
                { width: 8 },  // S.No
                { width: 25 }, // Name
                { width: 30 }, // Email
                { width: 15 }, // Phone
                { width: 40 }, // Address
                { width: 25 }, // Company
                { width: 15 }, // Registration Date
                { width: 10 }, // Status
                { width: 18 }, // Total Transactions
                { width: 15 }  // Total Spent
            ];

            XLSX.utils.book_append_sheet(workbook, worksheet, 'Customers');

            const filename = `customers_${new Date().toISOString().split('T')[0]}_${Date.now()}.xlsx`;
            const filepath = path.join(this.exportsDir, filename);

            XLSX.writeFile(workbook, filepath);

            return {
                success: true,
                filename,
                filepath,
                url: `/uploads/exports/${filename}`,
                recordCount: customers.length
            };
        } catch (error) {
            console.error('Customer export error:', error);
            throw error;
        }
    }

    // Export vehicles to Excel
    async exportVehicles(vehicles) {
        try {
            const workbook = XLSX.utils.book_new();
            
            const vehicleData = vehicles.map((vehicle, index) => ({
                'S.No': index + 1,
                'Vehicle Number': vehicle.vehicleNumber || 'N/A',
                'Vehicle Type': vehicle.vehicleType || 'N/A',
                'Owner Name': vehicle.ownerName || 'N/A',
                'Owner Phone': vehicle.ownerPhone || 'N/A',
                'Driver Name': vehicle.driverName || 'N/A',
                'Driver Phone': vehicle.driverPhone || 'N/A',
                'Driver License': vehicle.driverLicense || 'N/A',
                'Registration Date': new Date(vehicle.createdAt).toLocaleDateString('en-IN'),
                'Status': vehicle.status || 'active',
                'Total Visits': vehicle.totalVisits || 0,
                'Last Visit': vehicle.lastVisit ? new Date(vehicle.lastVisit).toLocaleDateString('en-IN') : 'N/A'
            }));

            const worksheet = XLSX.utils.json_to_sheet(vehicleData);
            
            worksheet['!cols'] = [
                { width: 8 },  // S.No
                { width: 20 }, // Vehicle Number
                { width: 15 }, // Vehicle Type
                { width: 25 }, // Owner Name
                { width: 15 }, // Owner Phone
                { width: 25 }, // Driver Name
                { width: 15 }, // Driver Phone
                { width: 20 }, // Driver License
                { width: 18 }, // Registration Date
                { width: 10 }, // Status
                { width: 12 }, // Total Visits
                { width: 15 }  // Last Visit
            ];

            XLSX.utils.book_append_sheet(workbook, worksheet, 'Vehicles');

            const filename = `vehicles_${new Date().toISOString().split('T')[0]}_${Date.now()}.xlsx`;
            const filepath = path.join(this.exportsDir, filename);

            XLSX.writeFile(workbook, filepath);

            return {
                success: true,
                filename,
                filepath,
                url: `/uploads/exports/${filename}`,
                recordCount: vehicles.length
            };
        } catch (error) {
            console.error('Vehicle export error:', error);
            throw error;
        }
    }

    // Export storage allocations to Excel
    async exportStorageAllocations(allocations) {
        try {
            const workbook = XLSX.utils.book_new();
            
            const allocationData = allocations.map((allocation, index) => ({
                'S.No': index + 1,
                'Customer Name': allocation.customer?.name || 'N/A',
                'Warehouse': allocation.warehouse?.name || 'N/A',
                'Building': allocation.building || 'N/A',
                'Block': allocation.block || 'N/A',
                'Wing': allocation.wing || 'N/A',
                'Box Number': allocation.boxNumber || 'N/A',
                'Item Description': allocation.itemDescription || 'N/A',
                'Quantity': allocation.quantity || 0,
                'Start Date': new Date(allocation.startDate).toLocaleDateString('en-IN'),
                'End Date': allocation.endDate ? new Date(allocation.endDate).toLocaleDateString('en-IN') : 'N/A',
                'Status': allocation.status || 'active',
                'Rate per Month': `₹${allocation.ratePerMonth || 0}`,
                'Total Amount': `₹${allocation.totalAmount || 0}`
            }));

            const worksheet = XLSX.utils.json_to_sheet(allocationData);
            
            worksheet['!cols'] = [
                { width: 8 },  // S.No
                { width: 25 }, // Customer Name
                { width: 20 }, // Warehouse
                { width: 12 }, // Building
                { width: 10 }, // Block
                { width: 10 }, // Wing
                { width: 12 }, // Box Number
                { width: 30 }, // Item Description
                { width: 10 }, // Quantity
                { width: 15 }, // Start Date
                { width: 15 }, // End Date
                { width: 12 }, // Status
                { width: 15 }, // Rate per Month
                { width: 15 }  // Total Amount
            ];

            XLSX.utils.book_append_sheet(workbook, worksheet, 'Storage Allocations');

            const filename = `storage_allocations_${new Date().toISOString().split('T')[0]}_${Date.now()}.xlsx`;
            const filepath = path.join(this.exportsDir, filename);

            XLSX.writeFile(workbook, filepath);

            return {
                success: true,
                filename,
                filepath,
                url: `/uploads/exports/${filename}`,
                recordCount: allocations.length
            };
        } catch (error) {
            console.error('Storage allocation export error:', error);
            throw error;
        }
    }

    // Export comprehensive report
    async exportComprehensiveReport(data) {
        try {
            const workbook = XLSX.utils.book_new();
            
            // Summary sheet
            const summaryData = [
                ['Warehouse Management System - Comprehensive Report'],
                ['Generated on:', new Date().toLocaleDateString('en-IN')],
                [''],
                ['Summary Statistics:'],
                ['Total Transactions:', data.transactions?.length || 0],
                ['Total Customers:', data.customers?.length || 0],
                ['Total Vehicles:', data.vehicles?.length || 0],
                ['Active Storage Allocations:', data.allocations?.filter(a => a.status === 'active').length || 0],
                ['Total Revenue:', `₹${data.totalRevenue || 0}`],
                [''],
                ['Report Sections:'],
                ['1. Transactions'],
                ['2. Customers'],
                ['3. Vehicles'],
                ['4. Storage Allocations']
            ];

            const summaryWs = XLSX.utils.aoa_to_sheet(summaryData);
            summaryWs['!cols'] = [{ width: 25 }, { width: 20 }];
            XLSX.utils.book_append_sheet(workbook, summaryWs, 'Summary');

            // Add individual sheets if data exists
            if (data.transactions?.length > 0) {
                const transactionData = data.transactions.map((t, i) => ({
                    'S.No': i + 1,
                    'Receipt': t.receiptNumber,
                    'Date': new Date(t.createdAt).toLocaleDateString('en-IN'),
                    'Customer': t.customer?.name,
                    'Vehicle': t.vehicle?.vehicleNumber,
                    'Amount': `₹${t.payment?.amount || 0}`,
                    'Status': t.payment?.status
                }));
                const transactionWs = XLSX.utils.json_to_sheet(transactionData);
                XLSX.utils.book_append_sheet(workbook, transactionWs, 'Transactions');
            }

            if (data.customers?.length > 0) {
                const customerData = data.customers.map((c, i) => ({
                    'S.No': i + 1,
                    'Name': c.name,
                    'Email': c.email,
                    'Phone': c.phone,
                    'Total Spent': `₹${c.totalSpent || 0}`
                }));
                const customerWs = XLSX.utils.json_to_sheet(customerData);
                XLSX.utils.book_append_sheet(workbook, customerWs, 'Customers');
            }

            const filename = `comprehensive_report_${new Date().toISOString().split('T')[0]}_${Date.now()}.xlsx`;
            const filepath = path.join(this.exportsDir, filename);

            XLSX.writeFile(workbook, filepath);

            return {
                success: true,
                filename,
                filepath,
                url: `/uploads/exports/${filename}`,
                totalRecords: Object.values(data).reduce((sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0), 0)
            };
        } catch (error) {
            console.error('Comprehensive report export error:', error);
            throw error;
        }
    }

    // Clean old export files (older than 24 hours)
    async cleanOldExports() {
        try {
            const files = fs.readdirSync(this.exportsDir);
            const now = Date.now();
            const oneDayAgo = now - (24 * 60 * 60 * 1000); // 24 hours in milliseconds

            for (const file of files) {
                const filePath = path.join(this.exportsDir, file);
                const stats = fs.statSync(filePath);
                
                if (stats.birthtime.getTime() < oneDayAgo) {
                    fs.unlinkSync(filePath);
                    console.log(`Cleaned old export file: ${file}`);
                }
            }
        } catch (error) {
            console.error('Error cleaning old exports:', error);
        }
    }
}

module.exports = new ExcelExportService();