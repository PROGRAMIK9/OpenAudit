import { useState } from 'react';

interface ShareReportProps {
  fileUrl: string;
}

const ShareReport = ({ fileUrl }: ShareReportProps) => {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const getAuthToken = () => localStorage.getItem('token');

  const fetchPdfBlob = async () => {
    const headers: HeadersInit = {};
    const token = getAuthToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(fileUrl, { headers });
    if (!response.ok) {
      throw new Error('Unable to fetch report file.');
    }
    return await response.blob();
  };

  const triggerDownload = async () => {
    const blob = await fetchPdfBlob();
    const downloadUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = downloadUrl;
    anchor.download = 'report.pdf';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(downloadUrl);
  };

  const handleShare = async () => {
    setLoading(true);
    setMessage('');

    try {
      if (navigator.share) {
        const blob = await fetchPdfBlob();
        const file = new File([blob], 'Financial_Report.pdf', { type: 'application/pdf' });
        await navigator.share({
          title: 'Financial Report',
          text: 'Here is my report',
          files: [file]
        });
        setMessage('Share sheet opened.');
        return;
      }

      await triggerDownload();
      setMessage('Native sharing is not available. The report download has started.');
    } catch (err: any) {
      setMessage(err?.message || 'Failed to share the report.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(fileUrl);
      setMessage('Link copied to clipboard.');
    } catch {
      setMessage('Copy failed. Please copy the link manually.');
    }
  };

  const handlePreview = () => {
    window.open(fileUrl, '_blank');
  };

  return (
    <div className="mt-6 p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
      <h3 className="text-lg font-semibold text-gray-900 mb-3">Share Report</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={handleShare}
          disabled={loading}
          className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold py-3 px-4 rounded transition"
        >
          {loading ? 'Preparing...' : 'Share Report'}
        </button>
        <button
          type="button"
          onClick={handlePreview}
          className="w-full bg-slate-100 hover:bg-slate-200 text-slate-900 font-semibold py-3 px-4 rounded transition"
        >
          Preview Report
        </button>
        <button
          type="button"
          onClick={triggerDownload}
          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 px-4 rounded transition"
        >
          Download Report
        </button>
        <button
          type="button"
          onClick={handleCopyLink}
          className="w-full bg-yellow-500 hover:bg-yellow-600 text-white font-semibold py-3 px-4 rounded transition"
        >
          Copy Link
        </button>
      </div>

      <div className="mt-4 text-sm text-gray-600 space-y-2">
        <p>Manual sharing options:</p>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <a
            href={`https://api.whatsapp.com/send?text=${encodeURIComponent(fileUrl)}`}
            target="_blank"
            rel="noreferrer"
            className="inline-block w-full sm:w-auto text-center bg-green-600 hover:bg-green-700 text-white py-2 px-3 rounded"
          >
            WhatsApp Link
          </a>
          <a
            href={`mailto:?subject=${encodeURIComponent('Financial Report')}&body=${encodeURIComponent('Here is my report: ' + fileUrl)}`}
            className="inline-block w-full sm:w-auto text-center bg-slate-900 hover:bg-slate-800 text-white py-2 px-3 rounded"
          >
            Email Link
          </a>
        </div>
      </div>

      {message && <p className="mt-4 text-sm text-slate-700">{message}</p>}
    </div>
  );
};

export default ShareReport;
