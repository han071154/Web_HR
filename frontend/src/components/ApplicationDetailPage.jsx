import { Download, ExternalLink, FileText, Save, UserCheck } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import { cvPreviewUrl, downloadCv } from '../cv.js';
import { applicationStatusClass, applicationStatusLabels, formatDateTime, toDateTimeInputValue } from '../format.js';
import Avatar from './Avatar.jsx';
import ConvertDialog from './ConvertDialog.jsx';
import HistoryTimeline from './HistoryTimeline.jsx';

// Quyền khớp với backend: HR nào cũng xử lý hồ sơ và chuyển thành nhân sự được.
const EDIT_ROLES = ['ADMIN', 'HR_MANAGER', 'HR_STAFF'];

// Các bước trên thanh tiến trình; bước cuối là kết quả (Đậu hoặc Trượt).
const STEPS = ['NEW', 'REVIEWING', 'INTERVIEW', 'RESULT'];

function stepIndex(status) {
  return status === 'HIRED' || status === 'REJECTED' ? 3 : STEPS.indexOf(status);
}

function formatFileSize(bytes) {
  if (!bytes) {
    return '';
  }

  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function Stepper({ status }) {
  const current = stepIndex(status);
  const resultLabel = status === 'HIRED' || status === 'REJECTED' ? applicationStatusLabels[status] : 'Kết quả';

  return (
    <ol className={`stepper${status === 'REJECTED' ? ' rejected' : ''}`}>
      {STEPS.map((step, index) => (
        <li key={step} className={index < current ? 'done' : index === current ? 'current' : ''}>
          <span className="stepper-dot">{index < current ? '✓' : index + 1}</span>
          <span>{step === 'RESULT' ? resultLabel : applicationStatusLabels[step]}</span>
        </li>
      ))}
    </ol>
  );
}

// Trang chi tiết hồ sơ ứng viên (Figma M-08d).
export default function ApplicationDetailPage({
  id,
  user,
  departments,
  positions,
  suggestedCode,
  onChanged,
  onConverted,
  showToast
}) {
  const [application, setApplication] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [form, setForm] = useState({ status: 'NEW', interviewAt: '', note: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewError, setPreviewError] = useState('');
  const [converting, setConverting] = useState(false);
  const canEdit = EDIT_ROLES.includes(user?.role);

  const load = useCallback(async () => {
    try {
      const response = await api.application(id);
      setApplication(response.data);
      setForm({
        status: response.data.status,
        interviewAt: toDateTimeInputValue(response.data.interviewAt),
        note: response.data.note || ''
      });
    } catch (err) {
      setLoadError(err.message);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  // Xem trước CV ngay trên trang: tải file PDF (kèm token) rồi hiện trong khung.
  useEffect(() => {
    let url = '';
    let ignore = false;

    if (!application?.id) {
      return undefined;
    }

    cvPreviewUrl(application)
      .then((objectUrl) => {
        url = objectUrl;

        if (ignore) {
          URL.revokeObjectURL(objectUrl);
        } else {
          setPreviewUrl(objectUrl);
        }
      })
      .catch((err) => {
        if (!ignore) {
          setPreviewError(err.message);
        }
      });

    return () => {
      ignore = true;

      if (url) {
        URL.revokeObjectURL(url);
      }
    };
    // Chỉ tải lại CV khi đổi sang hồ sơ khác, không phải mỗi lần lưu trạng thái.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [application?.id]);

  async function handleSave(event) {
    event.preventDefault();

    if (form.status === 'INTERVIEW' && !form.interviewAt) {
      setError('Vui lòng chọn lịch phỏng vấn.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      await api.updateApplication(id, {
        status: form.status,
        // datetime-local là giờ máy người dùng; gửi kèm múi giờ để backend lưu đúng thời điểm.
        interviewAt: form.interviewAt ? new Date(form.interviewAt).toISOString() : null,
        note: form.note.trim() || null
      });
      showToast('success', `Đã lưu hồ sơ ${application.applicationCode}.`);
      await load();
      onChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDownload() {
    try {
      await downloadCv(application);
    } catch (err) {
      showToast('error', err.message);
    }
  }

  if (loadError) {
    return <p className="form-error">{loadError}</p>;
  }

  if (!application) {
    return <p className="muted-text">Đang tải hồ sơ</p>;
  }

  const converted = Boolean(application.employeeId);
  const canConvert = canEdit && application.status === 'HIRED' && !converted;

  return (
    <div className="detail-split">
      <section className="content-panel panel-stack">
        <div className="applicant-header">
          <Avatar name={application.fullName} size="medium" />
          <div className="applicant-info">
            <h2>{application.fullName}</h2>
            <p className="page-subtitle">
              {application.applicationCode} · Ứng tuyển: {application.jobTitle}
            </p>
          </div>
          <span className={`status-pill ${applicationStatusClass[application.status]}`}>
            {applicationStatusLabels[application.status]}
          </span>
        </div>

        <dl className="detail-grid">
          <div>
            <dt>Email</dt>
            <dd>
              <a href={`mailto:${application.email}`}>{application.email}</a>
            </dd>
          </div>
          <div>
            <dt>Số điện thoại</dt>
            <dd>
              <a href={`tel:${application.phone}`}>{application.phone}</a>
            </dd>
          </div>
          <div>
            <dt>Vị trí ứng tuyển</dt>
            <dd>{application.jobTitle}</dd>
          </div>
          <div>
            <dt>Ngày nộp</dt>
            <dd>{formatDateTime(application.createdAt)}</dd>
          </div>
        </dl>

        <div>
          <h3>Thư giới thiệu</h3>
          <p className={application.coverLetter ? 'cover-letter' : 'muted-text'}>
            {application.coverLetter || 'Ứng viên không viết thư giới thiệu'}
          </p>
        </div>

        <div className="panel-stack">
          <h3>CV</h3>
          <div className="cv-file">
            <FileText size={22} aria-hidden="true" />
            <div>
              <strong>{application.cvOriginalName || `${application.applicationCode}.pdf`}</strong>
              <span>{formatFileSize(application.cvSize)}</span>
            </div>
            <a
              className={`ghost-button${previewUrl ? '' : ' disabled-link'}`}
              href={previewUrl || undefined}
              target="_blank"
              rel="noreferrer"
            >
              <ExternalLink size={16} aria-hidden="true" />
              Mở tab mới
            </a>
            <button type="button" className="primary-button" onClick={handleDownload}>
              <Download size={16} aria-hidden="true" />
              Tải xuống
            </button>
          </div>
          {previewError ? (
            <p className="form-error">{previewError}</p>
          ) : previewUrl ? (
            <iframe className="cv-preview" src={previewUrl} title={`CV của ${application.fullName}`} />
          ) : (
            <p className="muted-text">Đang tải bản xem trước CV</p>
          )}
        </div>
      </section>

      <div className="side-stack">
        <section className="content-panel panel-stack">
          <h2>Xử lý hồ sơ</h2>
          <Stepper status={application.status} />
          {error && <p className="form-error">{error}</p>}
          {canEdit ? (
            <form className="panel-stack" onSubmit={handleSave}>
              <label>
                Trạng thái
                <select
                  value={form.status}
                  onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}
                  disabled={converted}
                >
                  {Object.entries(applicationStatusLabels).map(([value, label]) => (
                    <option value={value} key={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Lịch phỏng vấn
                <input
                  type="datetime-local"
                  value={form.interviewAt}
                  onChange={(event) => setForm((current) => ({ ...current, interviewAt: event.target.value }))}
                  disabled={converted}
                />
                <small className="field-hint">Bắt buộc khi chọn &quot;Phỏng vấn&quot;</small>
              </label>
              <label>
                Ghi chú nội bộ
                <textarea
                  value={form.note}
                  onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))}
                  rows="3"
                  maxLength={2000}
                  placeholder="VD: Kinh nghiệm phù hợp, hẹn phỏng vấn tuần sau"
                />
              </label>
              <button type="submit" className="primary-button" disabled={saving}>
                <Save size={18} aria-hidden="true" />
                {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
              </button>
            </form>
          ) : (
            <p className="muted-text">Bạn chỉ có quyền xem hồ sơ này.</p>
          )}
        </section>

        <section className="content-panel panel-stack">
          <h2>Chuyển thành nhân sự</h2>
          {converted ? (
            <p>
              Đã chuyển thành nhân viên <strong>{application.employeeCode || '(hồ sơ nhân viên đã bị xóa)'}</strong>.
            </p>
          ) : (
            <p className="muted-text">
              Dùng được khi hồ sơ ở trạng thái &quot;Đậu&quot;. Tạo hồ sơ nhân viên và hợp đồng đầu tiên từ thông tin ứng
              viên.
            </p>
          )}
          {!converted && (
            <button type="button" className="primary-button" onClick={() => setConverting(true)} disabled={!canConvert}>
              <UserCheck size={18} aria-hidden="true" />
              Chuyển thành nhân sự
            </button>
          )}
        </section>

        <section className="content-panel panel-stack">
          <h2>Lịch sử</h2>
          <HistoryTimeline entries={application.history || []} />
        </section>
      </div>

      {converting && (
        <ConvertDialog
          application={application}
          departments={departments}
          positions={positions}
          suggestedCode={suggestedCode}
          onCancel={() => setConverting(false)}
          onConverted={async (updated) => {
            setConverting(false);
            showToast('success', `Đã chuyển ${application.fullName} thành nhân viên ${updated.employeeCode}.`);
            await load();
            onConverted();
          }}
        />
      )}
    </div>
  );
}
