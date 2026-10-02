import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import ApplicationsPanel from './ApplicationsPanel.jsx';
import JobPostingsPanel from './JobPostingsPanel.jsx';

// Mục Tuyển dụng phía HR: tab Tin tuyển dụng và tab Hồ sơ ứng viên.
export default function RecruitmentPanel({ user, departments, positions, suggestedCode, onEmployeesChanged, showToast }) {
  const [tab, setTab] = useState('applications');
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [jobFilter, setJobFilter] = useState('');

  const loadJobs = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const response = await api.jobs();
      setJobs(response.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  const newCount = jobs.reduce((total, job) => total + job.newApplicationCount, 0);

  return (
    <>
      <div className="tab-bar" role="tablist" aria-label="Tuyển dụng">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'applications'}
          className={tab === 'applications' ? 'active' : ''}
          onClick={() => setTab('applications')}
        >
          Hồ sơ ứng viên
          {newCount > 0 && <span className="count-pill">{newCount} mới</span>}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'jobs'}
          className={tab === 'jobs' ? 'active' : ''}
          onClick={() => setTab('jobs')}
        >
          Tin tuyển dụng
        </button>
      </div>

      {error && <p className="form-error">{error}</p>}

      {tab === 'jobs' ? (
        <JobPostingsPanel
          user={user}
          jobs={jobs}
          loading={loading}
          departments={departments}
          onChanged={loadJobs}
          onShowApplications={(job) => {
            setJobFilter(job.id);
            setTab('applications');
          }}
          showToast={showToast}
        />
      ) : (
        <ApplicationsPanel
          user={user}
          jobs={jobs}
          jobFilter={jobFilter}
          onJobFilterChange={setJobFilter}
          departments={departments}
          positions={positions}
          suggestedCode={suggestedCode}
          onChanged={loadJobs}
          onHired={() => {
            loadJobs();
            onEmployeesChanged();
          }}
          showToast={showToast}
        />
      )}
    </>
  );
}
