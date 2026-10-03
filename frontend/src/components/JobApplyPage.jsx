import { ArrowLeft, CircleCheck, CloudUpload, FileText, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { employmentTypeLabels, formatDate } from '../format.js';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^0\d{9}$/;
const CV_MAX_SIZE_MB = 5;

const emptyForm = { fullName: '', email: '', phone: '', coverLetter: '' };

function formatFileSize(bytes) {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// Cùng quy tắc với backend (POST /public/jobs/:id/applications) để báo lỗi ngay khi bấm nộp.
function validate(form, cvFile, consent) {
  const errors = {};

  if (form.fullName.trim().length < 2) {
    errors.fullName = 'Vui lòng nhập họ và tên.';
  }

  if (!EMAIL_PATTERN.test(form.email.trim())) {
    errors.email = form.email.trim() ? 'Email không hợp lệ.' : 'Vui lòng nhập email.';
  }

  if (!PHONE_PATTERN.test(form.phone.replace(/[\s.-]/g, ''))) {
    errors.phone = form.phone.trim() ? 'Số điện thoại phải có 10 chữ số, bắt đầu bằng 0.' : 'Vui lòng nhập số điện thoại.';
  }

  if (!cvFile) {
    errors.cv = 'Vui lòng đính kèm CV.';
  } else if (cvFile.type !== 'application/pdf' && !cvFile.name.toLowerCase().endsWith('.pdf')) {
    errors.cv = `Chỉ nhận file PDF, tối đa ${CV_MAX_SIZE_MB} MB.`;
  } else if (cvFile.size > CV_MAX_SIZE_MB * 1024 * 1024) {
    errors.cv = `CV không được lớn hơn ${CV_MAX_SIZE_MB} MB.`;
  }

  if (form.coverLetter.length > 3000) {
    errors.coverLetter = 'Thư giới thiệu tối đa 3000 ký tự.';
  }

  if (!consent) {
    errors.consent = 'Bạn cần đồng ý để công ty xử lý hồ sơ.';
  }

  return errors;
}

function ApplySuccess({ result }) {
  return (
    <div className="careers-card apply-card apply-success">
      <span className="apply-success-icon">
        <CircleCheck size={40} aria-hidden="true" />
      </span>
      <h1>Nộp hồ sơ thành công!</h1>
      <p>
        Cảm ơn {result.fullName} đã ứng tuyển vị trí {result.jobTitle}. Bộ phận nhân sự sẽ liên hệ qua email{' '}
        <strong>{result.email}</strong> trong 5–7 ngày làm việc.
      </p>
      <dl className="apply-summary">
        <div>
          <dt>Mã hồ sơ</dt>
          <dd>{result.applicationCode}</dd>
        </div>
        <div>
          <dt>Vị trí</dt>
          <dd>{result.jobTitle}</dd>
        </div>
        <div>
          <dt>Trạng thái</dt>
          <dd>
            <span className="count-pill">Mới nộp</span>
          </dd>
        </div>
        <div>
          <dt>Ngày nộp</dt>
          <dd>{formatDate(result.createdAt)}</dd>
        </div>
      </dl>
      <a href="#/viec-lam" className="primary-button careers-block-button">
        Xem việc làm khác
      </a>
      <a href="#/" className="ghost-button careers-block-button">
        Về trang chủ
      </a>
    </div>
  );
}

export default function JobApplyPage({ jobId }) {
  const [job, setJob] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [cvFile, setCvFile] = useState(null);
  const [consent, setConsent] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    api
      .publicJob(jobId)
      .then((response) => !cancelled && setJob(response.data))
      .catch((err) => !cancelled && setLoadError(err.message));

    return () => {
      cancelled = true;
    };
  }, [jobId]);

  function updateField(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
    setFieldErrors((current) => ({ ...current, [name]: undefined }));
  }

  function chooseFile(file) {
    if (!file) {
      return;
    }

    setCvFile(file);
    // Báo ngay nếu file sai loại hoặc quá lớn, không đợi bấm "Nộp hồ sơ".
    setFieldErrors((current) => ({ ...current, cv: validate(emptyForm, file, true).cv }));
  }

  function removeFile() {
    setCvFile(null);
    setFieldErrors((current) => ({ ...current, cv: undefined }));

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  function handleDrop(event) {
    event.preventDefault();
    setDragging(false);
    chooseFile(event.dataTransfer.files?.[0]);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');

    const errors = validate(form, cvFile, consent);
    setFieldErrors(errors);

    if (Object.keys(errors).length) {
      return;
    }

    setSubmitting(true);

    try {
      const response = await api.applyJob(
        jobId,
        {
          fullName: form.fullName.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          coverLetter: form.coverLetter.trim(),
          consent: 'true'
        },
        cvFile
      );
      setResult(response.data);
      window.scrollTo(0, 0);
    } catch (err) {
      setError(err.message);
      window.scrollTo(0, 0);
    } finally {
      setSubmitting(false);
    }
  }

  if (loadError) {
    return (
      <div className="careers-container careers-page">
        <div className="careers-card careers-message">
          <p className="form-error">{loadError}</p>
          <a href="#/viec-lam" className="ghost-button">
            <ArrowLeft size={16} aria-hidden="true" />
            Quay lại danh sách việc làm
          </a>
        </div>
      </div>
    );
  }

  if (!job) {
    return <p className="careers-container careers-empty">Đang tải form ứng tuyển...</p>;
  }

  if (result) {
    return (
      <div className="careers-container careers-page">
        <ApplySuccess result={result} />
      </div>
    );
  }

  if (!job.isOpen) {
    return (
      <div className="careers-container careers-page">
        <div className="careers-card careers-message">
          <h1>{job.title}</h1>
          <p className="form-error">Tin tuyển dụng đã hết hạn nhận hồ sơ.</p>
          <a href="#/viec-lam" className="ghost-button">
            <ArrowLeft size={16} aria-hidden="true" />
            Xem việc làm khác
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="careers-container careers-page">
      <nav className="breadcrumb" aria-label="Đường dẫn">
        <a href="#/viec-lam">Việc làm</a>
        <span className="breadcrumb-sep">/</span>
        <a href={`#/viec-lam/${job.id}`}>{job.title}</a>
        <span className="breadcrumb-sep">/</span>
        Ứng tuyển
      </nav>

      <form className="careers-card apply-card" onSubmit={handleSubmit} noValidate>
        <p className="apply-eyebrow">Ứng tuyển vị trí</p>
        <h1>{job.title}</h1>
        <p className="page-subtitle">
          {job.departmentName || 'Chưa phân phòng ban'} · {employmentTypeLabels[job.employmentType] || job.employmentType}
        </p>

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        <label>
          <span>
            Họ và tên <em className="required">*</em>
          </span>
          <input
            value={form.fullName}
            onChange={(event) => updateField('fullName', event.target.value)}
            placeholder="Nhập họ và tên"
            autoComplete="name"
            className={fieldErrors.fullName ? 'invalid' : ''}
            aria-invalid={Boolean(fieldErrors.fullName)}
          />
          {fieldErrors.fullName && <small className="field-error">{fieldErrors.fullName}</small>}
        </label>

        <label>
          <span>
            Email (Gmail) <em className="required">*</em>
          </span>
          <input
            type="email"
            value={form.email}
            onChange={(event) => updateField('email', event.target.value)}
            placeholder="vidu@gmail.com"
            autoComplete="email"
            className={fieldErrors.email ? 'invalid' : ''}
            aria-invalid={Boolean(fieldErrors.email)}
          />
          {fieldErrors.email ? (
            <small className="field-error">{fieldErrors.email}</small>
          ) : (
            <small className="field-hint">Nếu trúng tuyển, email này sẽ là tài khoản đăng nhập của bạn.</small>
          )}
        </label>

        <label>
          <span>
            Số điện thoại <em className="required">*</em>
          </span>
          <input
            type="tel"
            value={form.phone}
            onChange={(event) => updateField('phone', event.target.value)}
            placeholder="09xx xxx xxx"
            autoComplete="tel"
            className={fieldErrors.phone ? 'invalid' : ''}
            aria-invalid={Boolean(fieldErrors.phone)}
          />
          {fieldErrors.phone && <small className="field-error">{fieldErrors.phone}</small>}
        </label>

        <div className="apply-field">
          <span className="apply-label">
            CV <em className="required">*</em>
          </span>
          <input
            ref={fileInputRef}
            id="cv-file"
            type="file"
            accept="application/pdf,.pdf"
            className="visually-hidden"
            onChange={(event) => chooseFile(event.target.files?.[0])}
          />
          {cvFile ? (
            <div className={`cv-file${fieldErrors.cv ? ' invalid' : ''}`}>
              <FileText size={28} aria-hidden="true" />
              <div>
                <strong>{cvFile.name}</strong>
                <small>{formatFileSize(cvFile.size)}</small>
              </div>
              <button type="button" className="icon-button" onClick={removeFile} aria-label="Bỏ file CV" title="Bỏ file">
                <X size={16} aria-hidden="true" />
              </button>
            </div>
          ) : (
            <label
              htmlFor="cv-file"
              className={`cv-dropzone${dragging ? ' dragging' : ''}${fieldErrors.cv ? ' invalid' : ''}`}
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
            >
              <CloudUpload size={26} aria-hidden="true" />
              <span>
                Kéo thả file vào đây hoặc <b>chọn file</b>
              </span>
              <small>PDF, tối đa {CV_MAX_SIZE_MB} MB</small>
            </label>
          )}
          {fieldErrors.cv && <small className="field-error">{fieldErrors.cv}</small>}
        </div>

        <label>
          Thư giới thiệu (không bắt buộc)
          <textarea
            rows={4}
            value={form.coverLetter}
            onChange={(event) => updateField('coverLetter', event.target.value)}
            placeholder="Giới thiệu ngắn về bản thân..."
            className={fieldErrors.coverLetter ? 'invalid' : ''}
          />
          {fieldErrors.coverLetter && <small className="field-error">{fieldErrors.coverLetter}</small>}
        </label>

        <div>
          <label className="checkbox-field">
            <input
              type="checkbox"
              checked={consent}
              onChange={(event) => {
                setConsent(event.target.checked);
                setFieldErrors((current) => ({ ...current, consent: undefined }));
              }}
            />
            Tôi đồng ý cho công ty lưu và xử lý hồ sơ
          </label>
          {fieldErrors.consent && <small className="field-error">{fieldErrors.consent}</small>}
        </div>

        <button type="submit" className="primary-button careers-block-button" disabled={submitting}>
          {submitting ? 'Đang nộp hồ sơ...' : 'Nộp hồ sơ'}
        </button>
      </form>
    </div>
  );
}
