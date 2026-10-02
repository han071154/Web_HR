import { ExternalLink } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import ApplicationDetailPage from './ApplicationDetailPage.jsx';
import ApplicationsPanel from './ApplicationsPanel.jsx';
import JobFormPage from './JobFormPage.jsx';
import JobPostingsPanel from './JobPostingsPanel.jsx';

function Breadcrumb({ items }) {
  return (
    <nav className="breadcrumb recruitment-breadcrumb" aria-label="Đường dẫn">
      {items.map((item, index) => (
        <span key={item.label}>
          {index > 0 && <span className="breadcrumb-sep">/</span>}
          {item.onClick ? (
            <button type="button" onClick={item.onClick}>
              {item.label}
            </button>
          ) : (
            item.label
          )}
        </span>
      ))}
    </nav>
  );
}

// Mục Tuyển dụng phía HR (Figma M-08a–e). Màn con: danh sách (2 tab), trang đăng/sửa tin, trang chi tiết hồ sơ.
export default function RecruitmentPanel({
  user,
  departments,
  positions,
  suggestedCode,
  onEmployeesChanged,
  showToast
}) {
  const [tab, setTab] = useState('jobs');
  const [screen, setScreen] = useState({ type: 'list' });
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

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [screen]);

  const applicationCount = jobs.reduce((total, job) => total + job.applicationCount, 0);

  function showList(nextTab = tab) {
    setTab(nextTab);
    setScreen({ type: 'list' });
  }

  const listCrumb = { label: 'Tuyển dụng', onClick: () => showList() };

  if (screen.type === 'jobForm') {
    return (
      <>
        <Breadcrumb
          items={[
            listCrumb,
            { label: 'Tin tuyển dụng', onClick: () => showList('jobs') },
            { label: screen.job?.id ? `Sửa ${screen.job.code}` : 'Đăng tin mới' }
          ]}
        />
        <JobFormPage
          job={screen.job}
          departments={departments}
          onSaved={async () => {
            await loadJobs();
            showList('jobs');
          }}
          onCancel={() => showList('jobs')}
          showToast={showToast}
        />
      </>
    );
  }

  if (screen.type === 'application') {
    return (
      <>
        <Breadcrumb
          items={[
            listCrumb,
            { label: 'Hồ sơ ứng viên', onClick: () => showList('applications') },
            { label: screen.code || 'Chi tiết' }
          ]}
        />
        <ApplicationDetailPage
          id={screen.id}
          user={user}
          departments={departments}
          positions={positions}
          suggestedCode={suggestedCode}
          onChanged={loadJobs}
          onConverted={() => {
            loadJobs();
            onEmployeesChanged();
          }}
          showToast={showToast}
        />
      </>
    );
  }

  return (
    <>
      <div className="tab-row">
        <div className="tab-bar" role="tablist" aria-label="Tuyển dụng">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'jobs'}
            className={tab === 'jobs' ? 'active' : ''}
            onClick={() => setTab('jobs')}
          >
            Tin tuyển dụng <span className="count-pill">{jobs.length}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'applications'}
            className={tab === 'applications' ? 'active' : ''}
            onClick={() => setTab('applications')}
          >
            Hồ sơ ứng viên <span className="count-pill">{applicationCount}</span>
          </button>
        </div>
        <a className="text-link" href="#/viec-lam" target="_blank" rel="noreferrer">
          <ExternalLink size={15} aria-hidden="true" />
          Xem trang công khai
        </a>
      </div>

      {error && <p className="form-error">{error}</p>}

      {tab === 'jobs' ? (
        <JobPostingsPanel
          user={user}
          jobs={jobs}
          loading={loading}
          departments={departments}
          onChanged={loadJobs}
          onCreate={() => setScreen({ type: 'jobForm', job: null })}
          onEdit={(job, changes = {}) => setScreen({ type: 'jobForm', job: { ...job, ...changes } })}
          onShowApplications={(job) => {
            setJobFilter(job.id);
            setTab('applications');
          }}
          showToast={showToast}
        />
      ) : (
        <ApplicationsPanel
          jobs={jobs}
          jobFilter={jobFilter}
          onJobFilterChange={setJobFilter}
          onOpen={(application) =>
            setScreen({ type: 'application', id: application.id, code: application.applicationCode })
          }
          showToast={showToast}
        />
      )}
    </>
  );
}
