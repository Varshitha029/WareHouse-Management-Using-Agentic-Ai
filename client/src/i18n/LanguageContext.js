import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const LanguageContext = createContext();

// Default English translations (fallback keys)
const defaultTranslations = {
  common: {
    appTitle: 'Warehouse Management System',
    loading: 'Loading...',
    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete',
    edit: 'Edit',
    view: 'View',
    close: 'Close',
    submit: 'Submit',
    search: 'Search',
    filter: 'Filter',
    export: 'Export',
    download: 'Download',
    refresh: 'Refresh',
    actions: 'Actions',
    status: 'Status',
    date: 'Date',
    amount: 'Amount',
    type: 'Type',
    description: 'Description',
    profile: 'Profile',
    logout: 'Logout',
    settings: 'Settings',
    as: 'as',
    weighbridge: 'Weigh Bridge',
    yes: 'Yes',
    no: 'No',
    confirm: 'Confirm',
    success: 'Success',
    error: 'Error',
    warning: 'Warning',
    noData: 'No data available',
    currency: '₹',
    completed: 'Completed',
    noDescription: 'No description',
    viewDetails: 'View Details'
  },
  auth: {
    signIn: 'Sign In',
    signUp: 'Sign Up',
    login: 'Login',
    register: 'Register',
    email: 'Email',
    password: 'Password',
    username: 'Username',
    owner: 'Owner',
    customer: 'Customer',
    selectLoginType: 'Select Login Type',
    emailOrUsername: 'Email or Username',
    enterEmailOrUsername: 'Enter your email or username',
    passwordRequirements: 'At least 6 characters',
    noAccount: "Don't have an account?",
    haveAccount: 'Already have an account?',
    setPassword: 'Set Your Password',
    welcomeSetPassword: 'Welcome! Please set your password to continue.',
    currentPassword: 'Current Password',
    newPassword: 'New Password',
    confirmPassword: 'Confirm Password',
    minimumChars: 'Minimum 6 characters',
    passwordMismatch: 'Passwords do not match'
  },
  dashboard: {
    ownerDashboard: 'Owner Dashboard',
    customerDashboard: 'Customer Dashboard',
    totalVehicles: 'Total Vehicles',
    currentlyInside: 'Currently Inside',
    totalCustomers: 'Total Customers',
    totalEntries: 'Total Entries',
    warehouseLayoutManager: 'Warehouse Layout',
    userManagement: 'User Management',
    vehicleManagement: 'Vehicle Management',
    transactions: 'Transactions',
    customerRequests: 'Customer Requests',
    analytics: 'Analytics',
    predictions: 'Predictions',
    loanPortfolio: 'Loan Portfolio',
    alertsCenter: 'Alerts Center',
    vehicles: 'Vehicles',
    activeStorage: 'Active Storage',
    totalSpent: 'Total Spent',
    pendingPayments: 'Pending Payments',
    changePassword: 'Change Password',
    contactUs: 'Contact Us'
  },
  customer: {
    grainLocations: 'My Grain Locations',
    paymentOptions: 'Payment Options',
    marketPredictions: 'Market & Predictions',
    loanAlerts: 'Loan Alerts',
    loanCalculator: 'Loan Calculator',
    myRequests: 'My Requests'
  },
  alerts: {
    alertType: 'Alert Type',
    allAlerts: 'All Alerts',
    critical: 'Critical',
    criticalAlerts: 'Critical Alerts',
    customers: 'Customers',
    deselectAll: 'Deselect All',
    info: 'Info',
    information: 'Information',
    markAllRead: 'Mark All Read',
    markAllReadTooltip: 'Mark all alerts as read',
    markAsRead: 'Mark as Read',
    mlPredictions: 'ML Predictions',
    new: 'New',
    noAlerts: 'No alerts',
    noCustomersFound: 'No customers found',
    of: 'of',
    selectAll: 'Select All',
    selectCustomers: 'Select Customers',
    selected: 'Selected',
    sending: 'Sending...',
    title: 'Alerts Center',
    warning: 'Warning',
    warnings: 'Warnings',
    warningsTab: 'Warnings'
  },
  vehicles: {
    vehicleEntry: 'Vehicle Entry',
    vehicleNumber: 'Vehicle Number',
    driverName: 'Driver Name',
    vehicleType: 'Vehicle Type',
    allVehicles: 'All Vehicles',
    activeVehicles: 'Active Vehicles',
    cashPayment: 'Cash Payment',
    completed: 'Completed',
    customerDetailsRequired: 'Customer details required',
    customerDetailsRequiredAlert: 'Please fill in customer details before proceeding',
    customerEmail: 'Customer Email',
    customerInformation: 'Customer Information',
    customerName: 'Customer Name',
    customerPhone: 'Customer Phone',
    description: 'Description',
    driver: 'Driver',
    driverInformation: 'Driver Information',
    driverLicense: 'Driver License',
    driverPhone: 'Driver Phone',
    empty: 'Empty',
    emptyVehicleWeight: 'Empty Vehicle Weight',
    emptyWeightHelper: 'Weight of the empty vehicle in kg',
    generateUPIQR: 'Generate UPI QR',
    grainLoading: 'Grain Loading',
    grainWeight: 'Grain Weight',
    invalidWeight: 'Invalid weight',
    loaded: 'Loaded',
    loadedVehicleWeight: 'Loaded Vehicle Weight',
    loadedWeightHelper: 'Weight of the loaded vehicle in kg',
    net: 'Net',
    notStarted: 'Not Started',
    noVehiclesRegistered: 'No vehicles registered',
    paid: 'Paid',
    partial: 'Partial',
    pay: 'Pay',
    payment: 'Payment',
    paymentDoneConfirm: 'Payment done? Confirm',
    paymentReceived: 'Payment Received',
    pending: 'Pending',
    purpose: 'Purpose',
    purposeOfVisit: 'Purpose of Visit',
    registerNewVehicle: 'Register New Vehicle',
    registerVehicle: 'Register Vehicle',
    scanQRForPayment: 'Scan QR for Payment',
    scanWithUPIApp: 'Scan with any UPI app',
    secondWeigh: 'Second Weigh',
    selectPaymentMethod: 'Select Payment Method',
    selectVehicleStatus: 'Select Vehicle Status',
    selectVisitPurpose: 'Select Visit Purpose',
    selectWeighingOption: 'Select Weighing Option',
    title: 'Weigh Bridge',
    type: 'Type',
    upiPayment: 'UPI Payment',
    vehicle: 'Vehicle',
    vehicleCurrentStatus: 'Vehicle Current Status',
    vehicleEmptyNow: 'Vehicle is empty now',
    vehicleInformation: 'Vehicle Information',
    vehicleLoadedNow: 'Vehicle is loaded now',
    vehicleWillReturn: 'Vehicle will return',
    visitPurposeWeighingDetails: 'Visit Purpose & Weighing Details',
    weigh: 'Weigh',
    weighbridgePayment: 'Weighbridge Payment',
    weighingFee: 'Weighing Fee',
    weighingOnly: 'Weighing Only',
    weighingStatus: 'Weighing Status',
    weightInfo: 'Weight Info'
  },
  warehouse: {
    layout: 'Warehouse Layout',
    capacity: 'Capacity',
    allocate: 'Allocate',
    deallocate: 'Deallocate',
    building: 'Building',
    block: 'Block',
    wing: 'Wing',
    slot: 'Slot',
    addMoreBags: 'Add More Bags',
    allocatedOn: 'Allocated On',
    availableSpace: 'Available Space',
    blocksPerBuilding: 'Blocks Per Building',
    blocksPerBuildingLabel: 'Blocks per building',
    buildings: 'Buildings',
    columnsPerBlock: 'Columns Per Block',
    configureStructure: 'Configure Structure',
    createFirstLayout: 'Create your first layout',
    createLayout: 'Create Layout',
    customerDetails: 'Customer Details',
    customerId: 'Customer ID',
    customersInSlot: 'Customers in Slot',
    dateNotAvailable: 'Date not available',
    deallocateAll: 'Deallocate All',
    deleteLayout: 'Delete Layout',
    downloadJSON: 'Download JSON',
    dynamicLayouts: 'Dynamic Layouts',
    empty: 'Empty',
    full: 'Full',
    grid: 'Grid',
    maxBlocks: 'Max blocks',
    maxBuildings: 'Max buildings',
    noAllocations: 'No allocations',
    noLayouts: 'No layouts found',
    notes: 'Notes',
    numberOfBags: 'Number of Bags',
    numberOfBuildings: 'Number of Buildings',
    numberOfColumns: 'Number of Columns',
    numberOfRows: 'Number of Rows',
    occupancy: 'Occupancy',
    partiallyFilled: 'Partially Filled',
    quintals: 'Quintals',
    rowsPerBlock: 'Rows Per Block',
    status: 'Status',
    stillAvailable: 'Still Available',
    totalSlots: 'Total Slots',
    viewDetails: 'View Details',
    warehouseName: 'Warehouse Name'
  },
  grainLocations: {
    available: 'Available',
    bags: 'Bags',
    block: 'Block',
    building: 'Building',
    col: 'Col',
    contactOwner: 'Contact Owner',
    entryDate: 'Entry Date',
    errorFetchingLocations: 'Error fetching grain locations',
    filled: 'Filled',
    grainType: 'Grain Type',
    grainValue: 'Grain Value',
    loanEligibility: 'Loan Eligibility',
    location: 'Location',
    marketPrice: 'Market Price',
    maxLoanAvailable: 'Max Loan Available',
    noAllocations: 'No allocations found',
    notSpecified: 'Not specified',
    position: 'Position',
    quintal: 'Quintal',
    quintals: 'Quintals',
    refreshTooltip: 'Refresh grain locations',
    row: 'Row',
    slot: 'Slot',
    slotCapacityStatus: 'Slot Capacity Status',
    storageDetails: 'Storage Details',
    title: 'My Grain Locations',
    totalCapacity: 'Total Capacity',
    weight: 'Weight',
    weightQuintals: 'Weight (Quintals)'
  },
  loans: {
    loanAmount: 'Loan Amount',
    interestRate: 'Interest Rate',
    duration: 'Duration',
    status: 'Status',
    approve: 'Approve',
    reject: 'Reject',
    pending: 'Pending',
    active: 'Active',
    completed: 'Completed',
    errorFetchingAlerts: 'Error fetching loan alerts',
    loan: 'Loan',
    loanId: 'Loan ID'
  },
  market: {
    change: 'Change',
    currentPrice: 'Current Price',
    currentValue: 'Current Value',
    differentGrainTypes: 'Different Grain Types',
    errorFetchingPredictions: 'Error fetching predictions',
    errorFetchingPrices: 'Error fetching market prices',
    highestPriceToday: 'Highest Price Today',
    hold: 'Hold',
    lastUpdated: 'Last Updated',
    livePrices: 'Live Prices',
    localMarket: 'Local Market',
    marketType: 'Market Type',
    mostVolatile: 'Most Volatile',
    noData: 'No data available',
    noMarketData: 'No market data available',
    previousPrice: 'Previous Price',
    quantity: 'Quantity',
    refreshPrices: 'Refresh Prices',
    sellNow: 'Sell Now',
    storageDays: 'Storage Days',
    title: 'Market Prices & Predictions',
    trend: 'Trend',
    wait: 'Wait',
    yourGrainTypes: 'Your Grain Types'
  },
  payments: {
    cash: 'Cash',
    customPayment: 'Custom Payment',
    days: 'Days',
    description: 'Description',
    enterAmount: 'Enter Amount',
    enterCustomAmount: 'Enter custom amount',
    fixedCharge: 'Fixed Charge',
    loanRepayment: 'Loan Repayment',
    loanRepaymentFor: 'Loan Repayment for',
    noAllocationsFound: 'No allocations found',
    paymentMethod: 'Payment Method',
    paymentSummary: 'Payment Summary',
    paymentType: 'Payment Type',
    payPendingRent: 'Pay Pending Rent',
    proceedToPay: 'Proceed to Pay',
    processing: 'Processing...',
    razorpay: 'Razorpay',
    remaining: 'Remaining',
    rentPaymentFor: 'Rent Payment for',
    repayActiveLoan: 'Repay Active Loan',
    selectLoanToRepay: 'Select Loan to Repay',
    selectPaymentType: 'Select Payment Type',
    selectStorageAllocation: 'Select Storage Allocation',
    storageRentPayment: 'Storage Rent Payment',
    title: 'Payment Options',
    totalAmount: 'Total Amount',
    upi: 'UPI',
    weighbridgeFee: 'Weighbridge Fee',
    weighbridgeFeeDescription: 'Fee for weighbridge services'
  },
  transactions: {
    allTransactions: 'All Transactions',
    amount: 'Amount',
    amountRupees: 'Amount (₹)',
    bags: 'Bags',
    bankTransfer: 'Bank Transfer',
    barley: 'Barley',
    card: 'Card',
    cash: 'Cash',
    cheque: 'Cheque',
    completedToday: 'Completed Today',
    created: 'Created',
    createNewTransaction: 'Create New Transaction',
    createTransaction: 'Create Transaction',
    customer: 'Customer',
    customerId: 'Customer ID',
    date: 'Date',
    description: 'Description',
    descriptionPlaceholder: 'Enter transaction description',
    filter: 'Filter',
    grade: 'Grade',
    gradeAPremium: 'Grade A - Premium',
    gradeBStandard: 'Grade B - Standard',
    gradeCBasic: 'Grade C - Basic',
    grainDetails: 'Grain Details',
    grainStorageRent: 'Grain Storage Rent',
    grainType: 'Grain Type',
    loanRepayment: 'Loan Repayment',
    maize: 'Maize',
    markAsPaid: 'Mark as Paid',
    millet: 'Millet',
    newTransaction: 'New Transaction',
    noDescription: 'No description',
    numberOfBags: 'Number of Bags',
    overdue: 'Overdue',
    paymentMethod: 'Payment Method',
    pendingPayments: 'Pending Payments',
    quality: 'Quality',
    qualityGrade: 'Quality Grade',
    rice: 'Rice',
    sorghum: 'Sorghum',
    status: 'Status',
    title: 'Transactions',
    todayTransactions: 'Today\'s Transactions',
    totalRevenue: 'Total Revenue',
    transactionDetails: 'Transaction Details',
    transactionId: 'Transaction ID',
    transactionType: 'Transaction Type',
    type: 'Type',
    upi: 'UPI',
    weighbridgeFee: 'Weighbridge Fee',
    wheat: 'Wheat'
  },
  analytics: {
    revenue: 'Revenue & Analytics',
    financialReports: 'Financial Reports',
    grainAnalytics: 'Grain Analytics',
    storageDuration: 'Storage Duration',
    customerAnalytics: 'Customer Analytics',
    exportPdf: 'Export PDF'
  }
};

// Flatten nested object to dot notation
const flattenObject = (obj, prefix = '') => {
  return Object.keys(obj).reduce((acc, key) => {
    const pre = prefix.length ? prefix + '.' : '';
    if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
      Object.assign(acc, flattenObject(obj[key], pre + key));
    } else {
      acc[pre + key] = obj[key];
    }
    return acc;
  }, {});
};

const flatTranslations = flattenObject(defaultTranslations);

// Translation cache to avoid re-translating
const translationCache = {};

export const LanguageProvider = ({ children }) => {
  const [language, setLanguage] = useState(() => {
    return localStorage.getItem('preferredLanguage') || 'en';
  });
  const [translations, setTranslations] = useState(flatTranslations);
  const [isTranslating, setIsTranslating] = useState(false);

  // Translate text using server-side Google Translate API
  const translateTexts = useCallback(async (texts, targetLang) => {
    if (targetLang === 'en') return texts;
    
    const cacheKey = targetLang;
    if (translationCache[cacheKey]) {
      return translationCache[cacheKey];
    }

    try {
      const response = await axios.post('/api/translate', {
        texts,
        targetLanguage: targetLang
      });
      
      if (response.data.translations) {
        translationCache[cacheKey] = response.data.translations;
        return response.data.translations;
      }
      return texts;
    } catch (error) {
      console.error('Translation error:', error);
      return texts;
    }
  }, []);

  // When language changes, translate all default keys
  useEffect(() => {
    const doTranslation = async () => {
      if (language === 'en') {
        setTranslations(flatTranslations);
        return;
      }

      setIsTranslating(true);
      try {
        const keys = Object.keys(flatTranslations);
        const values = Object.values(flatTranslations);
        
        const translatedValues = await translateTexts(values, language);
        
        const newTranslations = {};
        keys.forEach((key, index) => {
          newTranslations[key] = translatedValues[index] || flatTranslations[key];
        });
        
        setTranslations(newTranslations);
      } catch (error) {
        console.error('Failed to translate, using defaults:', error);
        setTranslations(flatTranslations);
      } finally {
        setIsTranslating(false);
      }
    };

    doTranslation();
  }, [language, translateTexts]);

  // t function: resolve dot-notation key from translations
  const t = useCallback((key) => {
    return translations[key] || flatTranslations[key] || key;
  }, [translations]);

  // translateText: dynamically translate any arbitrary text
  const translateText = useCallback(async (text) => {
    if (language === 'en') return text;
    
    try {
      const response = await axios.post('/api/translate', {
        texts: [text],
        targetLanguage: language
      });
      return response.data.translations?.[0] || text;
    } catch (error) {
      return text;
    }
  }, [language]);

  const changeLanguage = useCallback((lang) => {
    setLanguage(lang);
    localStorage.setItem('preferredLanguage', lang);
    // Only update on server if user is logged in (has a token)
    if (localStorage.getItem('token')) {
      axios.put('/api/users/update-language', { language: lang }).catch(() => {});
    }
  }, []);

  return (
    <LanguageContext.Provider value={{
      language,
      changeLanguage,
      t,
      translateText,
      isTranslating,
      translations
    }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useTranslation = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    // Return fallback if used outside provider
    return {
      language: 'en',
      changeLanguage: () => {},
      t: (key) => flatTranslations[key] || key,
      translateText: async (text) => text,
      isTranslating: false,
      translations: flatTranslations
    };
  }
  return context;
};

export default LanguageContext;
