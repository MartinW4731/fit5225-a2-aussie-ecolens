import { useEffect, useState } from 'react'
import './App.css'

const API_BASE_URL = 'https://qpl03337ra.execute-api.ap-southeast-2.amazonaws.com'

const initialResponse = {
  message: 'No request submitted yet'
}

function App() {
  const [tagName, setTagName] = useState('')
  const [minimumCount, setMinimumCount] = useState(1)
  const [species, setSpecies] = useState('')
  const [thumbnailUrl, setThumbnailUrl] = useState('')
  const [queryFile, setQueryFile] = useState(null)
  const [uploadMediaFile, setUploadMediaFile] = useState(null)
  const [uploadPreviewUrl, setUploadPreviewUrl] = useState('')

  const [updateUrls, setUpdateUrls] = useState('')
  const [updateTags, setUpdateTags] = useState('')
  const [operation, setOperation] = useState('Add')

  const [deleteUrls, setDeleteUrls] = useState('')
  const [response, setResponse] = useState(initialResponse)
  const [loading, setLoading] = useState(false)
  const [selectedResult, setSelectedResult] = useState(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [currentPage, setCurrentPage] = useState('login')

  useEffect(() => {
    if (!uploadMediaFile || !uploadMediaFile.type.startsWith('image/')) {
      setUploadPreviewUrl('')
      return undefined
    }

    const previewUrl = URL.createObjectURL(uploadMediaFile)
    setUploadPreviewUrl(previewUrl)

    return () => URL.revokeObjectURL(previewUrl)
  }, [uploadMediaFile])

  const splitLines = (value) =>
    value
      .split('\n')
      .map((item) => item.trim())
      .filter(Boolean)

  const tagsToObject = (value) => {
    const tags = splitLines(value)
    const tagObject = {}

    tags.forEach((tag) => {
      tagObject[tag] = 1
    })

    return tagObject
  }

  const compressImageToBase64 = (file, maxWidth = 800, quality = 0.75) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader()

      reader.onload = (event) => {
        const img = new Image()

        img.onload = () => {
          const scale = Math.min(1, maxWidth / img.width)
          const canvas = document.createElement('canvas')

          canvas.width = Math.round(img.width * scale)
          canvas.height = Math.round(img.height * scale)

          const ctx = canvas.getContext('2d')
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

          const dataUrl = canvas.toDataURL('image/jpeg', quality)
          const base64 = dataUrl.split(',')[1]

          resolve({
            base64,
            originalSize: file.size,
            compressedSize: Math.round((base64.length * 3) / 4),
            width: canvas.width,
            height: canvas.height
          })
        }

        img.onerror = reject
        img.src = event.target.result
      }

      reader.onerror = reject
      reader.readAsDataURL(file)
    })

  const callApi = async (endpoint, payload) => {
    setLoading(true)

    try {
      const res = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      })

      const data = await res.json()

      setResponse({
        endpoint,
        request: payload,
        status: res.status,
        ...data
      })
    } catch (error) {
      setResponse({
        endpoint,
        request: payload,
        message: 'Request failed',
        error: String(error)
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSearchTags = () => {
    const finalTag = tagName.trim()

    if (!finalTag) {
      setResponse({ message: 'Please enter a tag name.' })
      return
    }

    const payload = {
      tags: {
        [finalTag]: Number(minimumCount) || 1
      }
    }

    callApi('/query/by-tags', payload)
  }

  const handleSearchSpecies = () => {
    const finalSpecies = species.trim()

    if (!finalSpecies) {
      setResponse({ message: 'Please enter a species tag.' })
      return
    }

    const payload = {
      tags: {
        [finalSpecies]: 1
      }
    }

    callApi('/query/by-tags', payload)
  }

  const handleSearchByUploadedFile = async () => {
    if (!queryFile) {
      setResponse({ message: 'Please choose a query image first.' })
      return
    }

    if (!queryFile.type.startsWith('image/')) {
      setResponse({
        message:
          'Please choose an image file. Video query upload is not enabled in this UI demo.'
      })
      return
    }

    setLoading(true)

    try {
      const compressedImage = await compressImageToBase64(queryFile)

      const payload = {
        file_name: queryFile.name,
        file_type: 'image',
        image_base64: compressedImage.base64
      }

      const res = await fetch(`${API_BASE_URL}/query/by-upload`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      })

      const data = await res.json()

      setResponse({
        endpoint: '/query/by-upload',
        request: {
          file_name: queryFile.name,
          file_type: 'image',
          image_base64: '[compressed base64 hidden in UI]',
          original_size_kb: Math.round(compressedImage.originalSize / 1024),
          compressed_size_kb: Math.round(compressedImage.compressedSize / 1024),
          compressed_width: compressedImage.width,
          compressed_height: compressedImage.height
        },
        status: res.status,
        ...data
      })
    } catch (error) {
      setResponse({
        endpoint: '/query/by-upload',
        message: 'Uploaded file search failed',
        error: String(error)
      })
    } finally {
      setLoading(false)
    }
  }

  const handleThumbnailLookup = () => {
    if (!thumbnailUrl.trim()) {
      setResponse({ message: 'Please enter a thumbnail URL.' })
      return
    }

    const payload = {
      thumbnail_url: thumbnailUrl.trim()
    }

    callApi('/query/by-thumbnail', payload)
  }

  const handleUpdateTags = () => {
    const urls = splitLines(updateUrls)
    const tags = tagsToObject(updateTags)

    if (urls.length === 0) {
      setResponse({ message: 'Please enter at least one file URL.' })
      return
    }

    if (Object.keys(tags).length === 0) {
      setResponse({ message: 'Please enter at least one tag.' })
      return
    }

    const payload = {
      urls,
      tags,
      operation: operation === 'Add' ? 1 : 0
    }

    callApi('/tags/update', payload)
  }

  const handleDeleteFiles = () => {
    const urls = splitLines(deleteUrls)

    if (urls.length === 0) {
      setResponse({ message: 'Please enter at least one file URL.' })
      return
    }

    const payload = {
      urls
    }

    callApi('/files/delete', payload)
  }

  const normaliseResults = () => {
    if (Array.isArray(response.results)) {
      return response.results
    }

    if (response.file_url || response.file_presigned_url) {
      return [
        {
          file_id: response.file_id || 'single-result',
          file_name: response.file_name,
          file_type: response.file_type,
          file_url: response.file_url,
          thumbnail_url: response.thumbnail_url,
          file_presigned_url: response.file_presigned_url,
          thumbnail_presigned_url: response.thumbnail_presigned_url,
          tags: response.tags || {},
          confidence: response.confidence || {},
          frames_processed: response.frames_processed || 0,
          ml_source: response.ml_source || ''
        }
      ]
    }

    return []
  }

  const renderDetectedTags = () => {
    if (!response.detected_tags) {
      return null
    }

    return (
      <div className="detected-box">
        <h3>Detected Tags From Uploaded File</h3>

        <p>
          <strong>Source:</strong> {response.source || 'Oracle ML detection'}
        </p>

        <p>
          <strong>Uploaded file:</strong>{' '}
          {response.uploaded_file_name || response.request?.file_name || ''}
        </p>

        {response.request?.original_size_kb && (
          <p>
            <strong>Image compression:</strong>{' '}
            {response.request.original_size_kb} KB →{' '}
            {response.request.compressed_size_kb} KB (
            {response.request.compressed_width} ×{' '}
            {response.request.compressed_height})
          </p>
        )}

        <p>
          <strong>Detected tags:</strong>
        </p>
        <pre className="small-pre">
          {JSON.stringify(response.detected_tags || {}, null, 2)}
        </pre>

        <p>
          <strong>Detection confidence:</strong>
        </p>
        <pre className="small-pre">
          {JSON.stringify(response.confidence || {}, null, 2)}
        </pre>
      </div>
    )
  }

  const renderResults = () => {
    const results = normaliseResults()

    if (results.length === 0 && !hasApiResponse(response)) {
      return null
    }

    return (
      <ResultGallery
        results={results}
        title="Media Results"
        onPreview={setSelectedResult}
      />
    )
  }

  const renderDeveloperResponse = () => (
    <details className="developer-response">
      <summary>Developer Details / Raw API Details</summary>
      <div className="developer-grid">
        <div>
          <h3>Endpoint</h3>
          <pre className="response-pre">{response.endpoint || 'No endpoint called yet'}</pre>
        </div>
        <div>
          <h3>HTTP Status</h3>
          <pre className="response-pre">
            {response.status ? String(response.status) : 'Not available'}
          </pre>
        </div>
        <div>
          <h3>Raw API Request</h3>
          <pre className="response-pre">
            {JSON.stringify(response.request || {}, null, 2)}
          </pre>
        </div>
        <div>
          <h3>Raw API Response</h3>
          <pre className="response-pre">{JSON.stringify(response, null, 2)}</pre>
        </div>
      </div>
    </details>
  )

  const renderResponsePanel = ({ showDetectedTags = false, showResults = false } = {}) => (
    <section className="response-section">
      <div className="section-heading">
        <h2>Response</h2>
        {response.endpoint && <span>{response.endpoint}</span>}
      </div>

      {loading && (
        <div className="loading-banner">
          <span className="spinner" aria-hidden="true" />
          Loading API response...
        </div>
      )}

      {response.error && (
        <div className="error-panel">
          <strong>Request error</strong>
          <span>{response.error}</span>
        </div>
      )}

      {showDetectedTags && renderDetectedTags()}
      {renderFriendlySummary(showResults)}
      {showResults && renderResults()}
      {renderDeveloperResponse()}
    </section>
  )

  const renderFriendlySummary = (showResults) => {
    const results = normaliseResults()

    if (!hasApiResponse(response) && response.message) {
      return (
        <div className="summary-card">
          <strong>{response.message}</strong>
        </div>
      )
    }

    if (response.endpoint === '/tags/update') {
      return <UpdateSummary response={response} />
    }

    if (response.endpoint === '/files/delete') {
      return <DeleteSummary response={response} />
    }

    if (response.endpoint === '/query/by-upload' && response.detected_tags) {
      return (
        <div className="summary-card">
          <strong>Query image processed without permanent UI storage.</strong>
          <span>
            Detected tags are shown below, followed by matching media returned by
            the API.
          </span>
        </div>
      )
    }

    if (showResults && hasApiResponse(response) && results.length === 0 && !response.error) {
      return (
        <div className="empty-results">
          <strong>No matching media files found.</strong>
          <span>Try a different tag, species, uploaded image, or thumbnail URL.</span>
        </div>
      )
    }

    if (response.message && hasApiResponse(response)) {
      return (
        <div className="summary-card">
          <strong>{response.message}</strong>
        </div>
      )
    }

    return null
  }

  const navigateTo = (page) => {
    setCurrentPage(page)
    setSelectedResult(null)
  }

  const handleLogin = () => {
    setIsAuthenticated(true)
    navigateTo('dashboard')
  }

  const handleLogout = () => {
    setIsAuthenticated(false)
    navigateTo('login')
  }

  const renderLoginPage = () => (
    <main className="login-page">
      <section className="login-card">
        <p className="eyebrow">UI placeholder</p>
        <h1>Aussie EcoLens</h1>
        <p>
          Login is a frontend-only navigation placeholder. It is not connected
          to a backend authentication API yet.
        </p>
        <label>
          Email
          <input type="email" placeholder="student@example.com" />
        </label>
        <label>
          Password
          <input type="password" placeholder="Password" />
        </label>
        <button type="button" onClick={handleLogin}>
          Login
        </button>
      </section>
    </main>
  )

  const renderDashboard = () => (
    <section className="dashboard-page">
      <div className="dashboard-hero">
        <p className="eyebrow">AWS + Oracle wildlife media platform</p>
        <h1>Aussie EcoLens</h1>
        <p>
          Search, inspect, and manage wildlife media using the connected AWS
          Lambda APIs and Oracle ML detection workflow.
        </p>
      </div>

      <div className="dashboard-grid">
        <button type="button" className="dashboard-card" onClick={() => navigateTo('upload-media')}>
          <span>Upload Media</span>
          <p>Prepare permanent image and video ingestion into S3 and DynamoDB.</p>
        </button>
        <button type="button" className="dashboard-card" onClick={() => navigateTo('search-tags')}>
          <span>Search By Tags</span>
          <p>Find media where detected tags meet a minimum count.</p>
        </button>
        <button type="button" className="dashboard-card" onClick={() => navigateTo('search-species')}>
          <span>Search By Species</span>
          <p>Search for wildlife records by species tag.</p>
        </button>
        <button type="button" className="dashboard-card" onClick={() => navigateTo('search-upload')}>
          <span>Search By Uploaded File</span>
          <p>Upload a query image for Oracle ML detection and similar media search.</p>
        </button>
        <button type="button" className="dashboard-card" onClick={() => navigateTo('thumbnail')}>
          <span>Thumbnail Lookup</span>
          <p>Resolve a thumbnail URL back to its original media record.</p>
        </button>
        <button type="button" className="dashboard-card" onClick={() => navigateTo('management')}>
          <span>Management</span>
          <p>Bulk update tags or delete test media files.</p>
        </button>
      </div>
    </section>
  )

  const renderUploadMediaPage = () => (
    <section className="page-panel">
      <p className="eyebrow">Permanent media ingestion</p>
      <h1>Upload Media</h1>
      <p className="page-subtitle">
        Add images or videos into the media database for future search.
      </p>

      <div className="notice-card">
        <strong>Upload Media API is not connected yet.</strong>
        <span>
          The backend currently supports S3-triggered processing after files are
          placed in uploads/, but the frontend upload endpoint or presigned
          upload URL API is still pending.
        </span>
      </div>

      <div className="upload-layout">
        <div className="form-card form-card-wide">
          <h2>Select Media</h2>
          <label>
            Image or video file
            <input
              type="file"
              accept="image/*,video/*"
              onChange={(event) => setUploadMediaFile(event.target.files[0] || null)}
            />
          </label>

          {uploadMediaFile ? (
            <div className="upload-file-summary">
              <dl>
                <div>
                  <dt>File name</dt>
                  <dd>{uploadMediaFile.name}</dd>
                </div>
                <div>
                  <dt>File type</dt>
                  <dd>{uploadMediaFile.type || 'Unknown media type'}</dd>
                </div>
                <div>
                  <dt>File size</dt>
                  <dd>{formatFileSize(uploadMediaFile.size)}</dd>
                </div>
              </dl>

              {uploadPreviewUrl && (
                <div className="upload-preview">
                  <img src={uploadPreviewUrl} alt="Selected upload preview" />
                </div>
              )}

              {uploadMediaFile.type.startsWith('video/') && (
                <div className="video-file-indicator">
                  <strong>Video selected</strong>
                  <span>
                    Video preview and permanent upload will be enabled after the
                    backend upload endpoint is available.
                  </span>
                </div>
              )}
            </div>
          ) : (
            <p className="helper-text">
              Choose an image or video to preview the metadata before future
              permanent ingestion.
            </p>
          )}

          <button
            type="button"
            disabled
            title="Waiting for backend upload endpoint."
          >
            Upload Media
          </button>
          <p className="helper-text">Waiting for backend upload endpoint.</p>
        </div>

        <div className="workflow-card">
          <h2>Permanent Ingestion Workflow</h2>
          <ol className="workflow-list">
            <li>Select media file</li>
            <li>Upload to S3 uploads/</li>
            <li>S3 triggers Lambda</li>
            <li>Oracle ML detects species</li>
            <li>Metadata is saved into DynamoDB</li>
            <li>Media becomes searchable</li>
          </ol>
        </div>
      </div>

      <section className="future-api-card">
        <h2>Future API Contract</h2>
        <div className="developer-grid">
          <div>
            <h3>Example Future Endpoint</h3>
            <pre className="response-pre">POST /upload-url</pre>
          </div>
          <div>
            <h3>Example Request</h3>
            <pre className="response-pre">
              {JSON.stringify(
                {
                  file_name: 'example.jpg',
                  file_type: 'image/jpeg'
                },
                null,
                2
              )}
            </pre>
          </div>
          <div>
            <h3>Example Response</h3>
            <pre className="response-pre">
              {JSON.stringify(
                {
                  upload_url: 'presigned PUT URL',
                  file_url: 's3://bucket/uploads/example.jpg'
                },
                null,
                2
              )}
            </pre>
          </div>
        </div>
      </section>

      <details className="developer-response upload-notes">
        <summary>Developer Notes</summary>
        <div className="developer-note-body">
          <p>
            This page is different from Search By Uploaded File. Search By
            Uploaded File is a temporary query upload and does not store the
            file.
          </p>
          <p>
            Upload Media is permanent ingestion. After the future upload
            endpoint places media in S3 uploads/, the S3-triggered Lambda should
            run Oracle ML detection and store media metadata in DynamoDB.
          </p>
        </div>
      </details>
    </section>
  )

  const renderSearchTagsPage = () => (
    <>
      <section className="page-panel">
        <div className="page-title-row">
          <div>
            <p className="eyebrow">DynamoDB tag query</p>
            <h1>Search By Tags</h1>
          </div>
        </div>
        <div className="form-card">
          <label>
            Tag name
            <input
              value={tagName}
              onChange={(event) => setTagName(event.target.value)}
              placeholder="thylogale_stigmatica"
            />
          </label>
          <label>
            Minimum count
            <input
              type="number"
              min="1"
              value={minimumCount}
              onChange={(event) => setMinimumCount(event.target.value)}
            />
          </label>
          <button type="button" onClick={handleSearchTags}>
            Search
          </button>
        </div>
      </section>
      {renderResponsePanel({ showResults: true })}
    </>
  )

  const renderSearchSpeciesPage = () => (
    <>
      <section className="page-panel">
        <p className="eyebrow">Species tag search</p>
        <h1>Search By Species</h1>
        <div className="form-card">
          <label>
            Species
            <input
              value={species}
              onChange={(event) => setSpecies(event.target.value)}
              placeholder="canis_familiaris"
            />
          </label>
          <button type="button" onClick={handleSearchSpecies}>
            Search
          </button>
        </div>
      </section>
      {renderResponsePanel({ showResults: true })}
    </>
  )

  const renderSearchUploadPage = () => (
    <>
      <section className="page-panel">
        <p className="eyebrow">Oracle ML query</p>
        <h1>Search By Uploaded File</h1>
        <div className="form-card form-card-wide">
          <p className="helper-text">
            Upload a query image. The frontend compresses it before sending it
            to the search API. The system detects its species tag using Oracle
            ML, then searches matching media from DynamoDB.
          </p>
          <label>
            Query image
            <input
              type="file"
              accept="image/*"
              onChange={(event) => setQueryFile(event.target.files[0])}
            />
          </label>
          {queryFile && (
            <p className="helper-text">
              Selected: {queryFile.name} ({Math.round(queryFile.size / 1024)} KB)
            </p>
          )}
          <button type="button" onClick={handleSearchByUploadedFile}>
            Search Similar Media
          </button>
        </div>
      </section>
      {renderResponsePanel({ showDetectedTags: true, showResults: true })}
    </>
  )

  const renderThumbnailPage = () => (
    <>
      <section className="page-panel">
        <p className="eyebrow">Thumbnail reverse lookup</p>
        <h1>Thumbnail Lookup</h1>
        <div className="form-card form-card-wide">
          <label>
            Thumbnail URL
            <input
              value={thumbnailUrl}
              onChange={(event) => setThumbnailUrl(event.target.value)}
              placeholder="s3://fit5225-a2-aussie-ecolens-media-group157/thumbnails/Thylogale_stigmatica_1.JPG"
            />
          </label>
          <button type="button" onClick={handleThumbnailLookup}>
            Find
          </button>
        </div>
      </section>
      {renderResponsePanel({ showResults: true })}
    </>
  )

  const renderManagementPage = () => (
    <>
      <section className="page-panel">
        <p className="eyebrow">Media record operations</p>
        <h1>Management</h1>
        <div className="management-grid">
          <div className="form-card">
            <h2>Update Tags</h2>
            <label>
              URLs
              <textarea
                value={updateUrls}
                onChange={(event) => setUpdateUrls(event.target.value)}
                placeholder="s3://fit5225-a2-aussie-ecolens-media-group157/uploads/Thylogale_stigmatica_1.JPG"
              />
            </label>
            <label>
              Tags
              <textarea
                value={updateTags}
                onChange={(event) => setUpdateTags(event.target.value)}
                placeholder="manual_checked"
              />
            </label>
            <label>
              Operation
              <select
                value={operation}
                onChange={(event) => setOperation(event.target.value)}
              >
                <option>Add</option>
                <option>Remove</option>
              </select>
            </label>
            <button type="button" onClick={handleUpdateTags}>
              Submit
            </button>
          </div>

          <div className="form-card danger-card">
            <h2>Delete Files</h2>
            <p className="helper-text">
              Destructive operation. Only use known test file URLs.
            </p>
            <label>
              URLs
              <textarea
                value={deleteUrls}
                onChange={(event) => setDeleteUrls(event.target.value)}
                placeholder="Only use test files here. One URL per line."
              />
            </label>
            <button className="danger" type="button" onClick={handleDeleteFiles}>
              Delete
            </button>
          </div>
        </div>
      </section>
      {renderResponsePanel()}
    </>
  )

  const renderCurrentPage = () => {
    if (!isAuthenticated || currentPage === 'login') {
      return renderLoginPage()
    }

    if (currentPage === 'search-tags') return renderSearchTagsPage()
    if (currentPage === 'search-species') return renderSearchSpeciesPage()
    if (currentPage === 'upload-media') return renderUploadMediaPage()
    if (currentPage === 'search-upload') return renderSearchUploadPage()
    if (currentPage === 'thumbnail') return renderThumbnailPage()
    if (currentPage === 'management') return renderManagementPage()

    return renderDashboard()
  }

  if (!isAuthenticated || currentPage === 'login') {
    return renderLoginPage()
  }

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="brand-block">
          <span>Aussie EcoLens</span>
          <small>Wildlife media console</small>
        </div>
        <nav className="nav-menu" aria-label="Main navigation">
          <NavButton currentPage={currentPage} page="dashboard" onClick={navigateTo}>
            Dashboard / Home
          </NavButton>
          <NavButton currentPage={currentPage} page="upload-media" onClick={navigateTo}>
            Upload Media
          </NavButton>
          <NavButton currentPage={currentPage} page="search-tags" onClick={navigateTo}>
            Search By Tags
          </NavButton>
          <NavButton currentPage={currentPage} page="search-species" onClick={navigateTo}>
            Search By Species
          </NavButton>
          <NavButton currentPage={currentPage} page="search-upload" onClick={navigateTo}>
            Search By Uploaded File
          </NavButton>
          <NavButton currentPage={currentPage} page="thumbnail" onClick={navigateTo}>
            Thumbnail Lookup
          </NavButton>
          <NavButton currentPage={currentPage} page="management" onClick={navigateTo}>
            Management
          </NavButton>
        </nav>
        <button className="logout-button" type="button" onClick={handleLogout}>
          Logout
        </button>
      </aside>

      <main className="page-shell">
        {renderCurrentPage()}
        <FullImageModal
          item={selectedResult}
          onClose={() => setSelectedResult(null)}
        />
      </main>
    </div>
  )
}

function NavButton({ children, currentPage, page, onClick }) {
  return (
    <button
      className={currentPage === page ? 'nav-button active' : 'nav-button'}
      type="button"
      onClick={() => onClick(page)}
    >
      {children}
    </button>
  )
}

function ResultGallery({ results, title, onPreview }) {
  if (results.length === 0) {
    return null
  }

  return (
    <section className="results-section">
      <div className="section-heading">
        <h2>{title}</h2>
        <span>{results.length} item{results.length === 1 ? '' : 's'}</span>
      </div>

      <div className="results-grid">
        {results.map((item, index) => (
          <ResultCard
            item={item}
            key={item.file_id || item.file_url || item.file_name || index}
            onPreview={() => onPreview(item)}
          />
        ))}
      </div>
    </section>
  )
}

function ResultCard({ item, onPreview }) {
  const thumbnailSrc = getPreviewUrl(
    item.thumbnail_presigned_url,
    item.thumbnail_url
  )
  const fullFileUrl = item.file_presigned_url || item.file_url || ''

  return (
    <article className="result-card">
      <button className="thumbnail-button" type="button" onClick={onPreview}>
        {thumbnailSrc ? (
          <img src={thumbnailSrc} alt={item.file_name || 'Result thumbnail'} />
        ) : (
          <div className="thumbnail-fallback">
            <strong>No browser preview</strong>
            <span>{item.thumbnail_url || item.file_url || 'No media URL'}</span>
          </div>
        )}
      </button>

      <div className="result-card-body">
        <div>
          <h3>{item.file_name || 'Result file'}</h3>
          <p>{item.file_type || 'file'}</p>
        </div>

        <TagList tags={item.tags || {}} />
        <ConfidenceSummary confidence={item.confidence || {}} />

        {item.file_type === 'video' && (
          <div className="video-label">
            <strong>Video file</strong>
            <span>{fullFileUrl || 'No video URL returned'}</span>
            <span>Frames: {item.frames_processed || 0}</span>
          </div>
        )}

        <div className="card-actions">
          <button type="button" onClick={onPreview}>
            Preview
          </button>

          {fullFileUrl && (
            <a href={fullFileUrl} target="_blank" rel="noreferrer">
              Open full {item.file_type || 'file'}
            </a>
          )}
        </div>
      </div>
    </article>
  )
}

function FullImageModal({ item, onClose }) {
  useEffect(() => {
    if (!item) {
      return undefined
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [item, onClose])

  if (!item) {
    return null
  }

  const previewSrc =
    getPreviewUrl(item.file_presigned_url, item.file_url) ||
    getPreviewUrl(item.thumbnail_presigned_url, item.thumbnail_url)

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="full-image-modal-title"
      onClick={onClose}
    >
      <div className="modal-content" onClick={(event) => event.stopPropagation()}>
        <button className="modal-close" type="button" onClick={onClose}>
          ×
        </button>

        <div className="modal-media">
          {previewSrc ? (
            <img src={previewSrc} alt={item.file_name || 'Full media preview'} />
          ) : (
            <div className="modal-fallback">
              <strong>Full image cannot be previewed in browser.</strong>
              <span>{item.file_url || 'No full file URL returned.'}</span>
            </div>
          )}
        </div>

        <aside className="modal-meta">
          <h2 id="full-image-modal-title">{item.file_name || 'Result file'}</h2>
          <dl>
            <div>
              <dt>Type</dt>
              <dd>{item.file_type || 'file'}</dd>
            </div>
            <div>
              <dt>S3 URL</dt>
              <dd>{item.file_url || 'Not returned'}</dd>
            </div>
            {item.ml_source && (
              <div>
                <dt>ML source</dt>
                <dd>{item.ml_source}</dd>
              </div>
            )}
            {item.file_type === 'video' && (
              <div>
                <dt>Frames</dt>
                <dd>{item.frames_processed || 0}</dd>
              </div>
            )}
          </dl>

          <div>
            <h3>Tags</h3>
            <TagList tags={item.tags || {}} />
          </div>

          <div>
            <h3>Confidence</h3>
            <pre className="small-pre">
              {JSON.stringify(item.confidence || {}, null, 2)}
            </pre>
          </div>
        </aside>
      </div>
    </div>
  )
}

function UpdateSummary({ response }) {
  const updatedItems = Array.isArray(response.updated_items)
    ? response.updated_items
    : []
  const operationLabel = response.operation === 1 ? 'Add' : 'Remove'

  return (
    <div className="summary-card">
      <strong>{response.message || 'Tag update completed.'}</strong>
      <dl className="summary-list">
        <div>
          <dt>Operation</dt>
          <dd>{operationLabel}</dd>
        </div>
        <div>
          <dt>Updated count</dt>
          <dd>{response.updated_count ?? updatedItems.length ?? 0}</dd>
        </div>
      </dl>
      {updatedItems.length > 0 && (
        <div>
          <p className="summary-label">Updated media</p>
          <ul className="url-list">
            {updatedItems.map((item, index) => (
              <li key={item.file_id || item.file_url || index}>
                {item.file_url || item.thumbnail_url || item.file_name || item.file_id}
              </li>
            ))}
          </ul>
        </div>
      )}
      {Array.isArray(response.not_found) && response.not_found.length > 0 && (
        <div>
          <p className="summary-label">Not found</p>
          <ul className="url-list">
            {response.not_found.map((url) => (
              <li key={url}>{url}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function DeleteSummary({ response }) {
  const deletedItems = Array.isArray(response.deleted_items)
    ? response.deleted_items
    : []

  return (
    <div className="summary-card delete-summary">
      <strong>{response.message || 'Delete operation completed.'}</strong>
      <dl className="summary-list">
        <div>
          <dt>Deleted count</dt>
          <dd>{response.deleted_count ?? deletedItems.length ?? 0}</dd>
        </div>
      </dl>
      {deletedItems.length > 0 && (
        <div>
          <p className="summary-label">Deleted media</p>
          <ul className="url-list">
            {deletedItems.map((item, index) => (
              <li key={item.file_id || index}>
                {item.file_name || item.file_id}
                {Array.isArray(item.deleted_s3_objects) &&
                  item.deleted_s3_objects.length > 0 &&
                  ` — ${item.deleted_s3_objects.join(', ')}`}
              </li>
            ))}
          </ul>
        </div>
      )}
      {Array.isArray(response.not_found) && response.not_found.length > 0 && (
        <div>
          <p className="summary-label">Not found</p>
          <ul className="url-list">
            {response.not_found.map((url) => (
              <li key={url}>{url}</li>
            ))}
          </ul>
        </div>
      )}
      {Array.isArray(response.errors) && response.errors.length > 0 && (
        <div>
          <p className="summary-label">Errors</p>
          <ul className="url-list">
            {response.errors.map((error, index) => (
              <li key={`${error.url || 'error'}-${index}`}>
                {error.url || 'Unknown URL'}: {error.error || JSON.stringify(error)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function ConfidenceSummary({ confidence }) {
  const entries = Object.entries(confidence)

  if (entries.length === 0) {
    return null
  }

  return (
    <div className="confidence-list">
      <strong>Confidence</strong>
      {entries.slice(0, 4).map(([label, value]) => (
        <span key={label}>
          {label}: {String(value)}
        </span>
      ))}
    </div>
  )
}

function TagList({ tags }) {
  const entries = Object.entries(tags)

  if (entries.length === 0) {
    return <p className="muted-text">No tags returned.</p>
  }

  return (
    <div className="tag-list">
      {entries.map(([tag, count]) => (
        <span key={tag}>
          {tag}: {count}
        </span>
      ))}
    </div>
  )
}

function hasApiResponse(response) {
  return Boolean(response.endpoint || response.status || response.error)
}

function getPreviewUrl(presignedUrl, rawUrl) {
  if (presignedUrl) {
    return presignedUrl
  }

  if (rawUrl && /^https?:\/\//i.test(rawUrl)) {
    return rawUrl
  }

  return ''
}

function formatFileSize(size) {
  if (!Number.isFinite(size)) {
    return 'Unknown size'
  }

  if (size < 1024) {
    return `${size} bytes`
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

export default App
