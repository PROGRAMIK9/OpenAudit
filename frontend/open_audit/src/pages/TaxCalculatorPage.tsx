import { useState } from 'react';
import axios from 'axios';
import { jsPDF } from 'jspdf';

interface TaxResult {
  message: string;
  oldRegime: {
    taxableIncome: number;
    tax: number;
  };
  newRegime: {
    taxableIncome: number;
    tax: number;
  };
  recommendation: string;
  savedRecord?: any;
}

function TaxCalculatorPage() {
  const [formData, setFormData] = useState({
    annualIncome: '',
    investments: '',
    otherDeductions: '',
    rentPaid: ''
  });
  const [result, setResult] = useState<TaxResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sharePhone, setSharePhone] = useState('');
  const [shareLoading, setShareLoading] = useState(false);
  const [shareMessage, setShareMessage] = useState('');

  const formatRupees = (value: number) => {
    return `Rs. ${value.toLocaleString('en-IN')}`;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSharePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSharePhone(e.target.value);
  };

  const createPdfDocument = () => {
    if (!result) return;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 14;
    const cardWidth = pageWidth - margin * 2;
    const savings = Math.abs(result.oldRegime.tax - result.newRegime.tax);
    const generatedDate = new Date().toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });

    const drawSectionTitle = (title: string, y: number) => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(31, 41, 55);
      doc.text(title, margin, y);
      doc.setDrawColor(229, 231, 235);
      doc.line(margin, y + 3, pageWidth - margin, y + 3);
    };

    const drawMetricCard = (
      title: string,
      taxableIncome: number,
      tax: number,
      x: number,
      y: number,
      accentColor: [number, number, number]
    ) => {
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(x, y, 86, 42, 4, 4, 'FD');

      doc.setFillColor(...accentColor);
      doc.roundedRect(x, y, 86, 8, 4, 4, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(255, 255, 255);
      doc.text(title, x + 5, y + 5.5);

      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text('Taxable Income', x + 5, y + 18);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      doc.text(formatRupees(taxableIncome), x + 5, y + 24);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text('Estimated Tax', x + 5, y + 33);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(...accentColor);
      doc.text(formatRupees(tax), x + 5, y + 39);
    };

    const drawInputRow = (label: string, value: string, y: number) => {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139);
      doc.text(label, margin + 6, y);

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(value, pageWidth - margin - 6, y, { align: 'right' });
    };

    doc.setFillColor(12, 74, 110);
    doc.rect(0, 0, pageWidth, 45, 'F');
    doc.setFillColor(14, 116, 144);
    doc.circle(pageWidth - 18, 12, 24, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(23);
    doc.setTextColor(255, 255, 255);
    doc.text('OpenAudit Tax Report', margin, 21);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(207, 250, 254);
    doc.text(`Generated on ${generatedDate}`, margin, 31);
    doc.text('Personalized tax regime comparison', margin, 38);

    doc.setFillColor(248, 250, 252);
    doc.rect(0, 45, pageWidth, pageHeight - 45, 'F');

    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(margin, 57, cardWidth, 44, 5, 5, 'FD');
    drawSectionTitle('Income & Deduction Inputs', 69);
    drawInputRow('Annual Income', formatRupees(Number(formData.annualIncome) || 0), 82);
    drawInputRow('Investments under 80C', formatRupees(Number(formData.investments) || 0), 90);
    drawInputRow('Other Deductions', formatRupees(Number(formData.otherDeductions) || 0), 98);
    drawInputRow('Rent Paid', formatRupees(Number(formData.rentPaid) || 0), 106);

    drawSectionTitle('Regime Comparison', 123);
    drawMetricCard('Old Regime', result.oldRegime.taxableIncome, result.oldRegime.tax, margin, 133, [220, 38, 38]);
    drawMetricCard('New Regime', result.newRegime.taxableIncome, result.newRegime.tax, pageWidth - margin - 86, 133, [22, 163, 74]);

    doc.setFillColor(238, 242, 255);
    doc.setDrawColor(199, 210, 254);
    doc.roundedRect(margin, 188, cardWidth, 38, 5, 5, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(67, 56, 202);
    doc.text('Recommendation', margin + 6, 201);
    doc.setFontSize(16);
    doc.setTextColor(30, 41, 59);
    doc.text(`Go with the ${result.recommendation}`, margin + 6, 211);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(79, 70, 229);
    doc.text(`Estimated savings: ${formatRupees(savings)}`, margin + 6, 220);

    doc.setDrawColor(203, 213, 225);
    doc.line(margin, pageHeight - 20, pageWidth - margin, pageHeight - 20);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text('Generated by OpenAudit', pageWidth / 2, pageHeight - 12, { align: 'center' });

    return doc;
  };

  const handleDownloadPdf = () => {
    if (!result) return;
    const doc = createPdfDocument();
    if (!doc) return;
    doc.save('tax-report.pdf');
  };

  const handleShareWhatsApp = async () => {
    if (!result) return;
    if (!sharePhone.trim()) {
      setShareMessage('Please enter a phone number in E.164 format, e.g. +919876543210.');
      return;
    }

    setShareLoading(true);
    setShareMessage('');

    try {
      const payload = {
        phone: sharePhone.trim(),
        result
      };
      const response = await axios.post('http://localhost:5000/api/tax/send-whatsapp', payload);
      setShareMessage(response.data?.message || 'WhatsApp message sent successfully.');
    } catch (err: any) {
      setShareMessage(err.response?.data?.message || err.response?.data?.error || 'Failed to share via WhatsApp.');
    } finally {
      setShareLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setResult(null);
    setShareMessage('');

    try {
      // Map to payload format matching the backend
      const payload = {
        annualIncome: Number(formData.annualIncome) || 0,
        investments: Number(formData.investments) || 0,
        otherDeductions: Number(formData.otherDeductions) || 0,
        rentPaid: Number(formData.rentPaid) || 0,
      };

      const response = await axios.post('http://localhost:5000/api/tax/calculate', payload);
      setResult(response.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to calculate taxes. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6 text-gray-800">Smart Tax Calculator</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Form Column */}
        <div className="bg-white p-6 rounded shadow-md">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-gray-700 text-sm font-bold mb-2">Annual Gross Income (Rs)</label>
              <input
                type="number"
                name="annualIncome"
                value={formData.annualIncome}
                onChange={handleChange}
                required
                min="0"
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. 1500000"
              />
            </div>
            
            <div>
              <label className="block text-gray-700 text-sm font-bold mb-2">Investments under 80C (Rs)</label>
              <input
                type="number"
                name="investments"
                value={formData.investments}
                onChange={handleChange}
                min="0"
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. 150000"
              />
            </div>

            <div>
              <label className="block text-gray-700 text-sm font-bold mb-2">Rent Paid Annually (Rs)</label>
              <input
                type="number"
                name="rentPaid"
                value={formData.rentPaid}
                onChange={handleChange}
                min="0"
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. 240000"
              />
            </div>

            <div>
              <label className="block text-gray-700 text-sm font-bold mb-2">Other Deductions (Rs)</label>
              <input
                type="number"
                name="otherDeductions"
                value={formData.otherDeductions}
                onChange={handleChange}
                min="0"
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. 50000"
              />
            </div>

            {error && <p className="text-red-500 text-sm">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded transition disabled:opacity-50"
            >
              {loading ? 'Calculating...' : 'Calculate Tax & Get Recommendation'}
            </button>
          </form>
        </div>

        {/* Results Column */}
        <div>
          {result ? (
            <div className="bg-white p-6 rounded shadow-md h-full flex flex-col justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-800 mb-4 border-b pb-2">Calculation Results</h2>
                
                <div className="mb-4">
                  <h3 className="text-lg font-semibold text-gray-700">Old Tax Regime</h3>
                  <p className="text-sm text-gray-500">Taxable Income: Rs. {result.oldRegime.taxableIncome.toLocaleString('en-IN')}</p>
                  <p className="text-2xl font-bold text-red-500">Rs. {result.oldRegime.tax.toLocaleString('en-IN')}</p>
                </div>

                <div className="mb-4">
                  <h3 className="text-lg font-semibold text-gray-700">New Tax Regime</h3>
                  <p className="text-sm text-gray-500">Taxable Income: Rs. {result.newRegime.taxableIncome.toLocaleString('en-IN')}</p>
                  <p className="text-2xl font-bold text-green-600">Rs. {result.newRegime.tax.toLocaleString('en-IN')}</p>
                </div>
              </div>

              <div className="mt-6 p-4 bg-indigo-50 rounded-lg border border-indigo-100">
                <h3 className="text-md font-bold text-indigo-800 uppercase tracking-wide">💡 Our Recommendation</h3>
                <p className="text-xl font-bold text-indigo-900 mt-1">Go with the {result.recommendation}</p>
                <p className="text-sm text-indigo-700 mt-2">
                  You will save Rs. {Math.abs(result.oldRegime.tax - result.newRegime.tax).toLocaleString('en-IN')} by choosing this regime.
                </p>
              </div>

              <div className="mt-6 p-4 bg-white rounded-lg border border-gray-200">
                <h3 className="text-md font-bold text-gray-800 mb-3">Actions</h3>
                <button
                  type="button"
                  onClick={handleDownloadPdf}
                  className="w-full mb-3 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded transition"
                >
                  Download PDF Report
                </button>

                <div className="space-y-3">
                  <label className="block text-gray-700 text-sm font-bold">WhatsApp Number</label>
                  <input
                    type="text"
                    value={sharePhone}
                    onChange={handleSharePhoneChange}
                    placeholder="+919876543210"
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                  <button
                    type="button"
                    onClick={handleShareWhatsApp}
                    disabled={shareLoading}
                    className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded transition disabled:opacity-50"
                  >
                    {shareLoading ? 'Sending...' : 'Share on WhatsApp'}
                  </button>
                  {shareMessage && <p className="text-sm mt-2 text-gray-700">{shareMessage}</p>}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-gray-50 p-6 rounded border border-dashed border-gray-300 h-full flex items-center justify-center text-gray-400 text-center">
              <p>Fill out the form and hit calculate to see your optimal tax regime comparison and tailored savings recommendation.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default TaxCalculatorPage;
