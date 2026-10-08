import { useState, useEffect } from 'react';
import { Shield, Clock, AlertTriangle, CheckCircle, XCircle, QrCode, Keyboard } from 'lucide-react';
import api from '../../services/api';

export default function GuardQRScanner() {
  const [mode, setMode] = useState('manual'); // 'manual' | 'camera'
  const [tokenInput, setTokenInput] = useState('');
  const [verifyResult, setVerifyResult] = useState(null);
  const [verifying, setVerifying] = useState(false);
  const [movementLoading, setMovementLoading] = useState(false);
  const [recentMovements, setRecentMovements] = useState([]);
  const [movementsLoading, setMovementsLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    loadRecentMovements();
  }, []);

  const loadRecentMovements = async () => {
    try {
      setMovementsLoading(true);
      const res = await api.get('/security/recent-movements');
      setRecentMovements(res.data.movements || []);
    } catch {
      // non-critical
    } finally {
      setMovementsLoading(false);
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    if (!tokenInput.trim()) return;
    setVerifying(true);
    setVerifyResult(null);
    setError('');
    setSuccessMsg('');
    try {
      const res = await api.post('/security/verification/verify-token', { token: tokenInput.trim() });
      setVerifyResult(res.data);
    } catch (err) {
      const msg = err.response?.data?.error || 'Verification failed';
      setVerifyResult({ valid: false, errorMessage: msg });
    } finally {
      setVerifying(false);
    }
  };

  const handleRecordMovement = async (movementType) => {
    if (!verifyResult?.pass) return;
    setMovementLoading(true);
    setError('');
    setSuccessMsg('');
    try {
      const res = await api.post('/security/verification/record-movement', {
        token: tokenInput.trim(),
        movementType,
        gateId: verifyResult.pass.gate_id || null
      });
      setSuccessMsg(`${movementType === 'checkout' ? 'Checkout' : 'Check-in'} recorded successfully at ${new Date().toLocaleTimeString()}`);
      setVerifyResult(null);
      setTokenInput('');
      loadRecentMovements();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to record movement');
    } finally {
      setMovementLoading(false);
    }
  };

  const getResultColor = () => {
    if (!verifyResult) return '';
    if (!verifyResult.valid) return 'border-red-500 bg-red-50';
    if (verifyResult.nextAllowedAction === 'checkin') return 'border-green-500 bg-green-50';
    return 'border-blue-500 bg-blue-50';
  };

  const getResultIcon = () => {
    if (!verifyResult) return null;
    if (!verifyResult.valid) return <XCircle className="w-10 h-10 text-red-500" />;
    return <CheckCircle className="w-10 h-10 text-green-500" />;
  };

  const fmt = (dt) => dt ? new Date(dt).toLocaleString() : '—';

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Shield className="w-7 h-7 text-blue-600" />
        <h1 className="text-2xl font-bold text-gray-900">Gate Security Scanner</h1>
      </div>

      {/* Input Panel */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setMode('manual')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${mode === 'manual' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            <Keyboard className="w-4 h-4" /> Manual Entry
          </button>
          <button
            onClick={() => setMode('camera')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${mode === 'camera' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            <QrCode className="w-4 h-4" /> QR Camera
          </button>
        </div>

        {mode === 'camera' && (
          <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-800 text-sm">
            <strong>Camera QR scanning</strong> requires HTTPS or localhost. For production, use a device with camera access. In development, use Manual Entry with the token string.
          </div>
        )}

        <form onSubmit={handleVerify} className="flex gap-3">
          <input
            type="text"
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            placeholder="Enter QR token (e.g. NC-PASS-xxxx-GP2026001) or pass number"
            className="flex-1 border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
          />
          <button
            type="submit"
            disabled={verifying || !tokenInput.trim()}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {verifying ? 'Verifying...' : 'Verify'}
          </button>
        </form>
      </div>

      {/* Messages */}
      {error && (
        <div className="bg-red-50 border border-red-300 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
          <XCircle className="w-5 h-5 flex-shrink-0" />{error}
        </div>
      )}
      {successMsg && (
        <div className="bg-green-50 border border-green-300 text-green-700 px-4 py-3 rounded-lg flex items-center gap-2">
          <CheckCircle className="w-5 h-5 flex-shrink-0" />{successMsg}
        </div>
      )}

      {/* Verification Result */}
      {verifyResult && (
        <div className={`rounded-xl border-2 p-6 ${getResultColor()}`}>
          <div className="flex items-start gap-4">
            {getResultIcon()}
            <div className="flex-1">
              {!verifyResult.valid ? (
                <div>
                  <h2 className="text-xl font-bold text-red-700">ACCESS DENIED</h2>
                  <p className="text-red-600 mt-1">{verifyResult.errorMessage || verifyResult.message}</p>
                </div>
              ) : (
                <div>
                  <h2 className="text-xl font-bold text-green-700">
                    PASS VALID — {verifyResult.nextAllowedAction === 'checkout' ? 'READY FOR CHECKOUT' : 'READY FOR CHECK-IN'}
                  </h2>
                  <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      ['Student', verifyResult.student?.name || verifyResult.pass?.student_name || '—'],
                      ['Roll No.', verifyResult.student?.roll_number || verifyResult.pass?.roll_number || '—'],
                      ['Reason', verifyResult.pass?.reason || '—'],
                      ['Valid Until', fmt(verifyResult.pass?.expected_return_time || verifyResult.token?.expires_at)],
                    ].map(([label, value]) => (
                      <div key={label} className="bg-white rounded-lg p-3 shadow-sm">
                        <div className="text-xs text-gray-500 uppercase font-medium">{label}</div>
                        <div className="text-sm font-semibold text-gray-900 mt-1">{value}</div>
                      </div>
                    ))}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-3 mt-4">
                    {verifyResult.nextAllowedAction === 'checkout' && (
                      <button
                        onClick={() => handleRecordMovement('checkout')}
                        disabled={movementLoading}
                        className="px-8 py-3 bg-blue-600 text-white rounded-lg font-bold text-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                      >
                        {movementLoading ? 'Recording...' : '⬆ CHECKOUT'}
                      </button>
                    )}
                    {verifyResult.nextAllowedAction === 'checkin' && (
                      <button
                        onClick={() => handleRecordMovement('checkin')}
                        disabled={movementLoading}
                        className="px-8 py-3 bg-green-600 text-white rounded-lg font-bold text-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                      >
                        {movementLoading ? 'Recording...' : '⬇ CHECK-IN'}
                      </button>
                    )}
                    <button
                      onClick={() => { setVerifyResult(null); setTokenInput(''); }}
                      className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 transition-colors"
                    >
                      Clear
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Recent Movements */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <Clock className="w-5 h-5 text-gray-400" /> Recent Gate Movements
          </h2>
          <button onClick={loadRecentMovements} className="text-sm text-blue-600 hover:underline">Refresh</button>
        </div>
        <div className="overflow-x-auto">
          {movementsLoading ? (
            <div className="text-center py-8 text-gray-500">Loading...</div>
          ) : recentMovements.length === 0 ? (
            <div className="text-center py-8 text-gray-400">No recent movements</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {['Student', 'Roll No.', 'Type', 'Gate', 'Time', 'Verified By'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {recentMovements.map((m) => (
                  <tr key={m.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{m.student_name || '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{m.roll_number || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${m.movement_type === 'checkout' ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>
                        {m.movement_type === 'checkout' ? '⬆ Out' : '⬇ In'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{m.gate_name || 'Main Gate'}</td>
                    <td className="px-4 py-3 text-gray-600">{fmt(m.recorded_at || m.created_at)}</td>
                    <td className="px-4 py-3 text-gray-600">{m.verified_by_name || m.guard_name || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
