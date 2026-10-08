import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import {
  CalendarCheck2,
  Users,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  BookOpen,
  Send,
  Edit3
} from 'lucide-react';

export const MarkAttendance = () => {
  const { user } = useAuth();
  const [classes, setClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [students, setStudents] = useState([]);
  const [sessionDate, setSessionDate] = useState(new Date().toISOString().split('T')[0]);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [topicCovered, setTopicCovered] = useState('');
  const [attendanceMap, setAttendanceMap] = useState({}); // { [studentId]: 'present' | 'absent' | 'late' }
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Fetch classes taught or managed
  useEffect(() => {
    const fetchClasses = async () => {
      try {
        const res = await api.get('/academic/classes');
        if (res.data.success && res.data.classes.length > 0) {
          setClasses(res.data.classes);
          setSelectedClassId(res.data.classes[0].id);
        }
      } catch (err) {
        console.error('Failed to load classes');
      }
    };
    fetchClasses();
  }, []);

  // Fetch enrolled students when class changes
  useEffect(() => {
    if (!selectedClassId) return;
    const fetchStudents = async () => {
      try {
        setLoading(true);
        const res = await api.get(`/academic/classes/${selectedClassId}/students`);
        if (res.data.success) {
          setStudents(res.data.students);
          // Default all to 'present'
          const initial = {};
          res.data.students.forEach((s) => {
            initial[s.id] = 'present';
          });
          setAttendanceMap(initial);
        }
      } catch (err) {
        setError('Failed to fetch enrolled students for this class.');
      } finally {
        setLoading(false);
      }
    };
    fetchStudents();
  }, [selectedClassId]);

  const setAllStatus = (status) => {
    const updated = {};
    students.forEach((s) => {
      updated[s.id] = status;
    });
    setAttendanceMap(updated);
  };

  const handleStatusChange = (studentId, status) => {
    setAttendanceMap((prev) => ({ ...prev, [studentId]: status }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (students.length === 0) {
      return setError('No students enrolled in this class to record attendance.');
    }

    setSubmitting(true);
    try {
      const attendanceList = students.map((s) => ({
        studentId: s.id,
        status: attendanceMap[s.id] || 'present'
      }));

      const res = await api.post('/academic/attendance/submit', {
        classId: selectedClassId,
        sessionDate,
        startTime,
        endTime,
        topicCovered,
        attendanceList
      });

      if (res.data.success) {
        setSuccess(res.data.message);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit attendance.');
    } finally {
      setSubmitting(false);
    }
  };

  const selectedClass = classes.find((c) => c.id === selectedClassId);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-white flex items-center gap-2.5">
          <CalendarCheck2 className="w-6 h-6 text-indigo-400" />
          <span>Faculty Attendance Register</span>
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          Record class attendance sessions, topic summaries, and maintain audit records.
        </p>
      </div>

      {/* Control Form */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1 uppercase tracking-wider">
              Select Assigned Class
            </label>
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950/70 border border-slate-800 rounded-xl text-white text-xs focus:outline-none focus:border-indigo-500"
            >
              {classes.length === 0 && <option value="">No classes available</option>}
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.subject_code} - Sec {c.section})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1 uppercase tracking-wider">
              Session Date
            </label>
            <input
              type="date"
              value={sessionDate}
              onChange={(e) => setSessionDate(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950/70 border border-slate-800 rounded-xl text-white text-xs focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1 uppercase tracking-wider">
              Session Time Window
            </label>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="px-2 py-2 bg-slate-950/70 border border-slate-800 rounded-xl text-white text-xs focus:outline-none focus:border-indigo-500"
              />
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="px-2 py-2 bg-slate-950/70 border border-slate-800 rounded-xl text-white text-xs focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1 uppercase tracking-wider">
              Topic / Lecture Title
            </label>
            <input
              type="text"
              value={topicCovered}
              onChange={(e) => setTopicCovered(e.target.value)}
              placeholder="e.g. Asynchronous I/O and SQL Pool"
              className="w-full px-3 py-2 bg-slate-950/70 border border-slate-800 rounded-xl text-white text-xs focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        {/* Quick Marking Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-800">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-semibold mr-1">Batch Actions:</span>
            <button
              type="button"
              onClick={() => setAllStatus('present')}
              className="px-3 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-medium transition"
            >
              Mark All Present
            </button>
            <button
              type="button"
              onClick={() => setAllStatus('absent')}
              className="px-3 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-medium transition"
            >
              Mark All Absent
            </button>
          </div>

          <div className="text-xs text-slate-400">
            Total Enrolled: <strong className="text-white">{students.length}</strong> | Present:{' '}
            <strong className="text-emerald-400">
              {Object.values(attendanceMap).filter((v) => v === 'present').length}
            </strong>{' '}
            | Absent:{' '}
            <strong className="text-rose-400">
              {Object.values(attendanceMap).filter((v) => v === 'absent').length}
            </strong>
          </div>
        </div>
      </div>

      {/* Feedback Alerts */}
      {success && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm flex items-center justify-between">
          <span>{success}</span>
          <button onClick={() => setSuccess('')} className="text-emerald-400 hover:text-white">✕</button>
        </div>
      )}
      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError('')} className="text-rose-400 hover:text-white">✕</button>
        </div>
      )}

      {/* Student Roster */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-950/80 text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-3.5 px-4 font-bold">Roll / Student ID</th>
                  <th className="py-3.5 px-4 font-bold">Student Name</th>
                  <th className="py-3.5 px-4 font-bold text-center">Status Selection</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {loading ? (
                  <tr>
                    <td colSpan="3" className="py-12 text-center text-slate-400">
                      <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                      <span>Loading enrolled student roster...</span>
                    </td>
                  </tr>
                ) : students.length === 0 ? (
                  <tr>
                    <td colSpan="3" className="py-12 text-center text-slate-400">
                      No students enrolled in this class yet.
                    </td>
                  </tr>
                ) : (
                  students.map((student) => {
                    const currentStatus = attendanceMap[student.id] || 'present';
                    return (
                      <tr key={student.id} className="hover:bg-slate-800/40 transition">
                        <td className="py-3.5 px-4 font-mono font-medium text-indigo-300 text-xs">
                          {student.student_id}
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-white">
                          <div>{student.full_name}</div>
                          <div className="text-xs text-slate-400 font-normal">{student.email}</div>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <div className="inline-flex rounded-xl bg-slate-950/80 p-1 border border-slate-800 gap-1">
                            <button
                              type="button"
                              onClick={() => handleStatusChange(student.id, 'present')}
                              className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                                currentStatus === 'present'
                                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                                  : 'text-slate-400 hover:text-white'
                              }`}
                            >
                              Present
                            </button>
                            <button
                              type="button"
                              onClick={() => handleStatusChange(student.id, 'late')}
                              className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                                currentStatus === 'late'
                                  ? 'bg-amber-600 text-white shadow-md shadow-amber-600/30'
                                  : 'text-slate-400 hover:text-white'
                              }`}
                            >
                              Late
                            </button>
                            <button
                              type="button"
                              onClick={() => handleStatusChange(student.id, 'absent')}
                              className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                                currentStatus === 'absent'
                                  ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30'
                                  : 'text-slate-400 hover:text-white'
                              }`}
                            >
                              Absent
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {students.length > 0 && (
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={submitting}
              className="px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-2xl text-sm transition shadow-lg shadow-indigo-600/30 flex items-center gap-2 disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              <span>{submitting ? 'Recording Session...' : 'Submit Attendance Session'}</span>
            </button>
          </div>
        )}
      </form>
    </div>
  );
};

export default MarkAttendance;
