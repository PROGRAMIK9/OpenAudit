import { useState } from 'react';
import axios from 'axios';
import ShareReport from '../components/ShareReport';

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

  const formatRupees = (value: number) => {
    return `Rs. ${value.toLocaleString('en-IN')}`;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setResult(null);

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

              {result.savedRecord?.id && (
                <ShareReport fileUrl={`http://localhost:5000/reports/${result.savedRecord.id}/download`} />
              )}
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
