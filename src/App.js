import React, { useState } from 'react';
import { saveAs } from 'file-saver';
import "./App.css";

const InvoiceGenerator = () => {
  const [formData, setFormData] = useState({
    invoiceType: '',
    sellerPan: '',
    sellerGstin: '',
    buyerPan: '',
    buyerGstin: '',
    productType: '',
    numInvoices: 1
  });
  const [error, setError] = useState('');

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const generateUniqueId = (prefix) => {
    return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  };

  const generateDates = () => {
    const currentDate = new Date();
    let paymentDueDate, grnDate, postingDate, transactionDate;

    if (formData.invoiceType === 'ERP') {
      // Payment Due Date: future within 180 days
      paymentDueDate = new Date(currentDate);
      paymentDueDate.setDate(currentDate.getDate() + Math.floor(Math.random() * 180) + 1);

      // GRN Date logic for ERP
      grnDate = new Date(currentDate);
      if (Math.random() < 0.5) {
        // Past date (1-44 days ago)
        const pastDays = 1 + Math.floor(Math.random() * 44);
        grnDate.setDate(currentDate.getDate() - pastDays);
      } else {
        // Future date (1-135 days ahead)
        const futureDays = 1 + Math.floor(Math.random() * 180);
        grnDate.setDate(currentDate.getDate() + futureDays);
      }

      // Other dates (postingDate, transactionDate) must be past, <=180 days
      const generateERPPastDate = () => {
        const date = new Date(currentDate);
        const daysAgo = 1 + Math.floor(Math.random() * 180);
        date.setDate(date.getDate() - daysAgo);
        return date;
      };

      postingDate = generateERPPastDate();
      transactionDate = generateERPPastDate();

    } else {
      // Existing C2FO logic
      paymentDueDate = new Date(currentDate);
      paymentDueDate.setDate(currentDate.getDate() + Math.floor(Math.random() * 180) + 1);
      
      grnDate = new Date(currentDate);
      if (Math.random() < 0.5) {
        grnDate.setDate(currentDate.getDate() - Math.floor(Math.random() * 44));
      } else {
        grnDate.setDate(currentDate.getDate() + Math.floor(Math.random() * 180) + 1);
      }
      
      const generatePastDate = () => {
        const date = new Date(currentDate);
        date.setDate(currentDate.getDate() - Math.floor(Math.random() * 180));
        return date;
      };

      postingDate = generatePastDate();
      transactionDate = generatePastDate();
    }

    return {
      postingDate,
      grnDate,
      transactionDate,
      paymentDueDate
    };
  };

  const generateCSV = () => {
    if (!Object.values(formData).every(val => val)) {
      setError('All fields are required');
      return;
    }
    setError('');

    let headers;
    let csvData = [];
    const baseVoucherId = 510000000;

    if (formData.invoiceType === 'ERP') {
      headers = [
        'company_id', 'company_name', 'company_gstin', 'company_pan', 'buyer_tax_id', 'buyer_pan',
        'invoice_id', 'amount', 'currency', 'transaction_date', 'grn_date', 'posting_date',
        'payment_due_date', 'transaction_type', 'voucher_id', 'voucher_line_id', 'fiscal_year',
        'adj_invoice_id', 'adj_reason_code', 'description', 'buyer_name', 'buyer_address',
        'sap_company_code', 'sap_reference_number', 'sap_vendor_number', 'credit_days',
        'sap_payment_term', 'market_type', 'treds_flag', 'sap_discount_base_amount', 'fp_status',
        'posting_key', 'document_type', 'business_place', 'product_type'
      ];

      const businessPlaces = [
        '1901|West Bengal Dabur',
        '0601|Haryana Dabur',
        '0201|Himachal Pradesh Dabur'
      ];

      for (let i = 1; i <= formData.numInvoices; i++) {
        const dates = generateDates();

        const row = {
          company_id: `AJAYCOM${i.toString().padStart(3, '0')}`,
          company_name: i % 4 === 0 ? 'Innovative Tech Pack Limited' : 'SAMSON GLOBAL PRIVATE LIMITED SAMSON GLOBAL PRIVATE LIMITED',
          company_gstin: formData.sellerGstin,
          company_pan: formData.sellerPan,
          buyer_tax_id: formData.buyerGstin,
          buyer_pan: formData.buyerPan,
          invoice_id: generateUniqueId('INVID'),
          amount: 1000,
          currency: 'INR',
          transaction_date: dates.transactionDate.toISOString().split('T')[0],
          grn_date: dates.grnDate.toISOString().split('T')[0],
          posting_date: dates.postingDate.toISOString().split('T')[0],
          payment_due_date: dates.paymentDueDate.toISOString().split('T')[0],
          transaction_type: 1,
          voucher_id: baseVoucherId + i,
          voucher_line_id: 1,
          fiscal_year: new Date().getFullYear(),
          adj_invoice_id: '',
          adj_reason_code: '',
          description: generateUniqueId('DESCRIPTION'),
          buyer_name: 'Dabur India Ltd.',
          buyer_address: '8/3 Asaf Ali Road|IN',
          sap_company_code: '1000',
          sap_reference_number: generateUniqueId('SAPREF'),
          sap_vendor_number: 110268,
          credit_days: 30,
          sap_payment_term: `Z${Math.random() < 0.5 ? 'C' : 'V'}${Math.floor(10 + Math.random() * 90)}`,
          market_type: 'TREDS',
          treds_flag: 'Y',
          sap_discount_base_amount: 10000,
          fp_status: 'Funded by TReDS',
          posting_key: 31,
          document_type: 'RE',
          business_place: businessPlaces[Math.floor(Math.random() * businessPlaces.length)],
          product_type: formData.productType === 'Normal' ? '' : formData.productType
        };

        csvData.push(row);
      }
    } else {
      headers = [
        'company_id', 'company_name', 'division_id', 'sap_reference_number', 'company_pan',
        'buyer_pan', 'company_tax_id', 'buyer_tax_id', 'posting_date', 'grn_date',
        'transaction_date', 'pay_date', 'payment_due_date', 'invoice_id', 'voucher_id',
        'voucher_line_id', 'amount', 'currency', 'discount_percentage', 'income',
        'discounted_invoice_amount', 'offer_apr_amount', 'transaction_type', 'fiscal_year',
        'adj_invoice_id', 'sequential_document_number', 'buyer_name', 'sap_vendor_number',
        'credit_days', 'sap_payment_term', 'fp_status', 'market_type', 'treds_flag',
        'sap_company_code', 'discount_reason_code', 'covers_adjustment', 'adj_invoice_amount',
        'product_type', 'description'
      ];

      for (let i = 1; i <= formData.numInvoices; i++) {
        const dates = generateDates();
        const amount = Math.floor(Math.random() * 100000);
        const discountPercentage = parseFloat((Math.random() * 1).toFixed(2));
        const income = parseFloat((Math.abs(amount) * discountPercentage / 100).toFixed(2));
        
        const row = {
          company_id: `AJAYCOMPANY${i.toString().padStart(2, '0')}`,
          company_name: `Company ${i}`,
          division_id: '',
          sap_reference_number: generateUniqueId('SAPREF'),
          company_pan: formData.sellerPan,
          buyer_pan: formData.buyerPan,
          company_tax_id: formData.sellerGstin,
          buyer_tax_id: formData.buyerGstin,
          posting_date: dates.postingDate.toISOString().split('T')[0],
          grn_date: dates.grnDate.toISOString().split('T')[0],
          transaction_date: dates.transactionDate.toISOString().split('T')[0],
          pay_date: dates.paymentDueDate.toISOString().split('T')[0],
          payment_due_date: dates.paymentDueDate.toISOString().split('T')[0],
          invoice_id: generateUniqueId('INVID'),
          voucher_id: baseVoucherId + i,
          voucher_line_id: 1,
          amount: amount,
          currency: 'INR',
          discount_percentage: discountPercentage,
          income: income,
          discounted_invoice_amount: amount > 0 ? 
            (amount - income).toFixed(2) : 
            (amount + income).toFixed(2),
          offer_apr_amount: parseFloat((Math.random() * (15 - 10) + 10).toFixed(1)),
          transaction_type: formData.productType === 'BIFactoring' ? 2 : 1,
          fiscal_year: new Date().getFullYear(),
          adj_invoice_id: '',
          sequential_document_number: `${formData.invoiceType}-Doc-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000000 + Math.random() * 9000000)}-${i.toString().padStart(2, '0')}`,
          buyer_name: 'Dabur India Ltd.',
          sap_vendor_number: Math.floor(100000 + Math.random() * 900000),
          credit_days: [30, 35, 40][Math.floor(Math.random() * 3)],
          sap_payment_term: `Z${Math.random() < 0.5 ? 'C' : 'V'}${Math.floor(10 + Math.random() * 90)}`,
          fp_status: 'Funded by TReDS',
          market_type: 'TREDS',
          treds_flag: 'Y',
          sap_company_code: '1000',
          discount_reason_code: '',
          covers_adjustment: '0',
          adj_invoice_amount: '',
          product_type: formData.productType === 'Normal' ? '' : formData.productType,
          description: generateUniqueId('DESCRIPTION'),
        };

        csvData.push(row);
      }
    }

    const csv = [
      headers.join(','),
      ...csvData.map(row => headers.map(field => row[field]).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, 'invoices.csv');
  };

  return (
    <div className="invoice-generator">
      <h1>Invoice Generator</h1>
      {error && <div className="error">{error}</div>}
      
      <div className="form-group">
        <label>Invoice Type:</label>
        <select 
          name="invoiceType" 
          value={formData.invoiceType} 
          onChange={handleInputChange}
        >
          <option value="">Select</option>
          <option value="C2FO">C2FO</option>
          <option value="ERP">ERP</option>
          {/* <option value="Buyer Self Upload">Buyer Self Upload</option>
          <option value="Seller Self Upload">Seller Self Upload</option> */}
        </select>
      </div>

      <div className="form-group">
        <label>Seller PAN:</label>
        <input
          type="text"
          name="sellerPan"
          value={formData.sellerPan}
          onChange={handleInputChange}
        />
      </div>

      <div className="form-group">
        <label>Seller GSTIN:</label>
        <input
          type="text"
          name="sellerGstin"
          value={formData.sellerGstin}
          onChange={handleInputChange}
        />
      </div>

      <div className="form-group">
        <label>Buyer PAN:</label>
        <input
          type="text"
          name="buyerPan"
          value={formData.buyerPan}
          onChange={handleInputChange}
        />
      </div>

      <div className="form-group">
        <label>Buyer GSTIN:</label>
        <input
          type="text"
          name="buyerGstin"
          value={formData.buyerGstin}
          onChange={handleInputChange}
        />
      </div>

      <div className="form-group">
        <label>Product Type:</label>
        <select
          name="productType"
          value={formData.productType}
          onChange={handleInputChange}
        >
          <option value="">Select</option>
          <option value="RFDDueDate">RFDDueDate</option>
          <option value="BIFactoring">BIFactoring</option>
          <option value="Normal">Normal</option>
        </select>
      </div>

      <div className="form-group">
        <label>Number of Invoices:</label>
        <input
          type="number"
          name="numInvoices"
          min="1"
          max="100"
          value={formData.numInvoices}
          onChange={handleInputChange}
        />
      </div>

      <button onClick={generateCSV}>Generate Invoices</button>
    </div>
  );
};

export default InvoiceGenerator;