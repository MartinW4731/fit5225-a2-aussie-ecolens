import { useEffect, useRef, useState } from 'react'
import './App.css'

const pages = {
  dashboard: 'Dashboard',
  upload: 'Upload Media',
  search: 'Search Wildlife',
  thumbnail: 'Thumbnail Lookup',
  manage: 'Manage Files',
  notifications: 'Notifications'
}

const sampleResults = [
  {
    file_name: 'koala_001.jpg',
    file_url: 'https://example.com/full/koala_001.jpg',
    thumbnail_url: 'https://placehold.co/220x150?text=Koala',
    file_type: 'image',
    tags: { Koala: 2 }
  },
  {
    file_name: 'wombat_002.jpg',
    file_url: 's3://aussie-ecolens/uploads/wombat_002.jpg',
    thumbnail_url: 's3://aussie-ecolens/thumbnails/wombat_002.jpg',
    file_type: 'image',
    tags: { Wombat: 1, Burrow: 1 }
  },
  {
    file_name: 'kangaroo_003.mp4',
    file_url: 'https://example.com/full/kangaroo_003.mp4',
    thumbnail_url: 'https://placehold.co/220x150?text=Kangaroo',
    file_type: 'video',
    tags: { Kangaroo: 3 }
  },
  {
    file_name: 'dingo_004.jpg',
    file_url: 'https://example.com/full/dingo_004.jpg',
    thumbnail_url: 'https://placehold.co/220x150?text=Dingo',
    file_type: 'image',
    tags: { Dingo: 1 }
  }
]

const initialResponse = {
  message: 'No action submitted yet'
}

function isPreviewableUrl(url) {
  return Boolean(url && /^https?:\/\//i.test(url))
}

function getTagCount(tags, requestedTag) {
  const normalizedRequestedTag = requestedTag.trim().toLowerCase()

  if (!normalizedRequestedTag) {
    return 0
  }

  const matchedEntry = Object.entries(tags).find(
    ([tag]) => tag.toLowerCase() === normalizedRequestedTag
  )

  return matchedEntry ? Number(matchedEntry[1]) : 0
}

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [page, setPage] = useState('dashboard')
  const [response, setResponse] = useState(initialResponse)
  const [selectedResult, setSelectedResult] = useState(null)
  const [searchResults, setSearchResults] = useState([])
  const [hasSearched, setHasSearched] = useState(false)

  const [loginEmail, setLoginEmail] = useState('')
  const [password, setPassword] = useState('')
  const [uploadFile, setUploadFile] = useState(null)
  const [tagName, setTagName] = useState('')
  const [minimumCount, setMinimumCount] = useState(1)
  const [species, setSpecies] = useState('')
  const [thumbnailUrl, setThumbnailUrl] = useState('')
  const [lookupResult, setLookupResult] = useState(null)
  const [updateUrls, setUpdateUrls] = useState('')
  const [updateTags, setUpdateTags] = useState('')
  const [operation, setOperation] = useState('Add')
  const [deleteUrls, setDeleteUrls] = useState('')
  const [notifyEmail, setNotifyEmail] = useState('')
  const [notifyTag, setNotifyTag] = useState('')

  const splitLines = (value) =>
    value
      .split('\n')
      .map((item) => item.trim())
      .filter(Boolean)

  const navigate = (nextPage) => {
    setPage(nextPage)
    setResponse(initialResponse)
    setSelectedResult(null)
    setLookupResult(null)

    if (nextPage === 'search') {
      setSearchResults([])
      setHasSearched(false)
    }
  }

  const handleLogin = () => {
    setIsAuthenticated(true)
    setPage('dashboard')
    setResponse({
      message: 'Login successful',
      email: loginEmail || 'student@example.com',
      destination: 'Dashboard'
    })
  }

  const handleRegister = () => {
    setResponse({
      message: 'Fake registration response',
      email: loginEmail || 'student@example.com',
      status: 'Account would be created here'
    })
  }

  const handleLogout = () => {
    setIsAuthenticated(false)
    setPage('dashboard')
    setResponse(initialResponse)
  }

  const handleUpload = () => {
    const result = {
      file_name: uploadFile?.name || 'sample-koala.jpg',
      status: 'uploaded',
      message: "Fake upload complete. This will later connect to Kevin's AWS upload API."
    }

    setResponse(result)
  }

  const handleSearchTags = () => {
    const queryTag = tagName || 'Koala'
    const requiredCount = Number(minimumCount) || 1
    const matchingResults = sampleResults.filter(
      (item) => getTagCount(item.tags, queryTag) >= requiredCount
    )
    const result = {
      endpoint: 'Search By Tags',
      query: {
        tags: {
          [queryTag]: requiredCount
        }
      },
      count: matchingResults.length,
      results: matchingResults,
      message:
        matchingResults.length > 0
          ? 'Fake search by tags response'
          : 'No matching wildlife records found.'
    }

    setSearchResults(matchingResults)
    setHasSearched(true)
    setSelectedResult(null)
    setResponse(result)
  }

  const handleSearchSpecies = () => {
    const querySpecies = species || 'Koala'
    const matchingResults = sampleResults.filter(
      (item) => getTagCount(item.tags, querySpecies) >= 1
    )
    const result = {
      endpoint: 'Search By Tags',
      query: {
        species: querySpecies
      },
      count: matchingResults.length,
      results: matchingResults,
      message:
        matchingResults.length > 0
          ? 'Fake search by species response'
          : 'No matching wildlife records found.'
    }

    setSearchResults(matchingResults)
    setHasSearched(true)
    setSelectedResult(null)
    setResponse(result)
  }

  const handleSelectResult = (item) => {
    setSelectedResult(item)
    setResponse({
      message: 'Selected media result',
      file_url: item.file_url,
      result: item
    })
  }

  const handleThumbnailLookup = () => {
    const result = {
      thumbnail_url:
        thumbnailUrl || 'https://placehold.co/220x150?text=Thumbnail',
      file_url: 'https://placehold.co/720x420?text=Original+Image',
      file_name: 'original_image.jpg',
      file_type: 'image',
      tags: { Koala: 1 }
    }

    setLookupResult(result)
    setResponse({
      endpoint: 'Get Image By Thumbnail',
      message: 'Fake original image lookup response',
      ...result
    })
  }

  const handleUpdateTags = () => {
    const urls = splitLines(updateUrls)
    const tags = splitLines(updateTags)
    const result = {
      message: 'Tags updated successfully',
      operation: operation === 'Add' ? 1 : 0,
      updated_count: urls.length,
      updated_items: urls.map((url, index) => ({
        file_id: `mock-file-${index + 1}`,
        file_name: `media_${index + 1}.jpg`,
        file_url: url,
        thumbnail_url: url.includes('thumbnail') ? url : '',
        updated_tags: Object.fromEntries(tags.map((tag) => [tag, 1]))
      })),
      not_found: []
    }

    setResponse(result)
  }

  const handleDeleteFiles = () => {
    const urls = splitLines(deleteUrls)
    const result = {
      message: 'Delete operation completed',
      deleted_count: urls.length,
      deleted_items: urls.map((url, index) => ({
        file_id: `mock-file-${index + 1}`,
        file_name: `media_${index + 1}.jpg`,
        deleted_s3_objects: [url],
        deleted_from_dynamodb: true
      })),
      not_found: [],
      errors: []
    }

    setResponse(result)
  }

  const handleSubscribe = () => {
    const result = {
      message: 'Subscription request sent',
      email: notifyEmail || 'student@example.com',
      tag: notifyTag || 'Koala',
      subscription_arn: 'pending confirmation'
    }

    setResponse(result)
  }

  if (!isAuthenticated) {
    return (
      <main className="auth-page">
        <section className="login-card">
          <p className="eyebrow">FIT5225 university demo</p>
          <h1>Aussie EcoLens</h1>
          <label>
            Email
            <input
              type="email"
              value={loginEmail}
              onChange={(event) => setLoginEmail(event.target.value)}
              placeholder="student@example.com"
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Password"
            />
          </label>
          <div className="button-row">
            <button type="button" onClick={handleLogin}>
              Login
            </button>
            <button className="secondary" type="button" onClick={handleRegister}>
              Register
            </button>
          </div>
          <ResponsePanel response={response} compact />
        </section>
      </main>
    )
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Aussie EcoLens</p>
          <h1>{pages[page]}</h1>
        </div>
        <div className="nav-actions">
          {page !== 'dashboard' && (
            <button className="secondary" type="button" onClick={() => navigate('dashboard')}>
              Back to Dashboard
            </button>
          )}
          <button className="secondary" type="button" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </header>

      {page === 'dashboard' && <Dashboard onNavigate={navigate} />}
      {page === 'upload' && (
        <UploadMedia
          uploadFile={uploadFile}
          setUploadFile={setUploadFile}
          onUpload={handleUpload}
          response={response}
        />
      )}
      {page === 'search' && (
        <SearchWildlife
          tagName={tagName}
          setTagName={setTagName}
          minimumCount={minimumCount}
          setMinimumCount={setMinimumCount}
          species={species}
          setSpecies={setSpecies}
          onSearchTags={handleSearchTags}
          onSearchSpecies={handleSearchSpecies}
          results={searchResults}
          hasSearched={hasSearched}
          selectedResult={selectedResult}
          onSelectResult={handleSelectResult}
          onClosePreview={() => setSelectedResult(null)}
          response={response}
        />
      )}
      {page === 'thumbnail' && (
        <ThumbnailLookup
          thumbnailUrl={thumbnailUrl}
          setThumbnailUrl={setThumbnailUrl}
          lookupResult={lookupResult}
          onLookup={handleThumbnailLookup}
          response={response}
        />
      )}
      {page === 'manage' && (
        <ManageFiles
          updateUrls={updateUrls}
          setUpdateUrls={setUpdateUrls}
          updateTags={updateTags}
          setUpdateTags={setUpdateTags}
          operation={operation}
          setOperation={setOperation}
          deleteUrls={deleteUrls}
          setDeleteUrls={setDeleteUrls}
          onUpdateTags={handleUpdateTags}
          onDeleteFiles={handleDeleteFiles}
          response={response}
        />
      )}
      {page === 'notifications' && (
        <Notifications
          email={notifyEmail}
          setEmail={setNotifyEmail}
          tag={notifyTag}
          setTag={setNotifyTag}
          onSubscribe={handleSubscribe}
          response={response}
        />
      )}
    </main>
  )
}

function Dashboard({ onNavigate }) {
  const cards = [
    {
      page: 'upload',
      title: 'Upload Media',
      description: "Upload images and videos before Kevin's AWS pipeline processes them."
    },
    {
      page: 'search',
      title: 'Search Wildlife',
      description: 'Find media by detected tags or species names.'
    },
    {
      page: 'thumbnail',
      title: 'Thumbnail Lookup',
      description: 'Resolve a thumbnail URL back to its original media file.'
    },
    {
      page: 'manage',
      title: 'Manage Files',
      description: 'Bulk update tags or delete related media records.'
    },
    {
      page: 'notifications',
      title: 'Notifications',
      description: 'Subscribe an email address to tag-based wildlife alerts.'
    }
  ]

  return (
    <>
      <section className="oracle-card">
        <div>
          <p className="eyebrow">Oracle second cloud</p>
          <h2>ML Detection Service</h2>
          <p>
            Oracle-hosted wildlife detection will enrich uploaded media with species
            labels before results are stored for search and notification workflows.
          </p>
        </div>
        <span className="status-pill">Demo status: mocked</span>
      </section>

      <section className="dashboard-grid" aria-label="Dashboard navigation">
        {cards.map((card) => (
          <button
            className="dashboard-card"
            key={card.page}
            type="button"
            onClick={() => onNavigate(card.page)}
          >
            <span>{card.title}</span>
            <p>{card.description}</p>
          </button>
        ))}
      </section>
    </>
  )
}

function UploadMedia({ uploadFile, setUploadFile, onUpload, response }) {
  return (
    <section className="content-grid single">
      <div className="card">
        <h2>Upload Media</h2>
        <label>
          Image or video file
          <input
            type="file"
            accept="image/*,video/*"
            onChange={(event) => setUploadFile(event.target.files?.[0] || null)}
          />
        </label>
        {uploadFile && <p className="help-text">Selected: {uploadFile.name}</p>}
        <button type="button" onClick={onUpload}>
          Upload
        </button>
      </div>
      <ResponsePanel response={response} />
    </section>
  )
}

function SearchWildlife({
  tagName,
  setTagName,
  minimumCount,
  setMinimumCount,
  species,
  setSpecies,
  onSearchTags,
  onSearchSpecies,
  results,
  hasSearched,
  selectedResult,
  onSelectResult,
  onClosePreview,
  response
}) {
  const hasSearchResults = results.length > 0

  return (
    <>
      <section className="content-grid">
        <div className="card">
          <h2>Search by Tags</h2>
          <label>
            Tag name
            <input
              value={tagName}
              onChange={(event) => setTagName(event.target.value)}
              placeholder="Koala"
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
          <button type="button" onClick={onSearchTags}>
            Search
          </button>
        </div>

        <div className="card">
          <h2>Search by Species</h2>
          <label>
            Species name
            <input
              value={species}
              onChange={(event) => setSpecies(event.target.value)}
              placeholder="Koala"
            />
          </label>
          <button type="button" onClick={onSearchSpecies}>
            Search
          </button>
        </div>
      </section>

      {hasSearchResults && (
        <section className="card gallery-section">
          <h2>Search Results</h2>
          <div className="gallery">
            {results.map((item) => (
              <article className="result-card" key={item.file_name}>
                <button
                  className="thumb-button"
                  type="button"
                  onClick={() => onSelectResult(item)}
                >
                  <MediaPreview url={item.thumbnail_url} alt={item.file_name} />
                </button>
                <div className="result-body">
                  <h3>{item.file_name}</h3>
                  <p>{item.file_type}</p>
                  <p className="tag-line">{formatTags(item.tags)}</p>
                  <button type="button" onClick={() => onSelectResult(item)}>
                    View Full Image
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {hasSearched && !hasSearchResults && (
        <section className="card empty-state">
          <h2>Search Results</h2>
          <p>No matching wildlife records found.</p>
        </section>
      )}

      <section className="content-grid">
        <ResponsePanel response={response} />
      </section>

      <FullImageModal
        key={selectedResult?.file_name || 'empty-preview'}
        item={selectedResult}
        onClose={onClosePreview}
      />
    </>
  )
}

function ThumbnailLookup({
  thumbnailUrl,
  setThumbnailUrl,
  lookupResult,
  onLookup,
  response
}) {
  return (
    <section className="content-grid">
      <div className="card">
        <h2>Thumbnail Lookup</h2>
        <label>
          Thumbnail URL
          <input
            value={thumbnailUrl}
            onChange={(event) => setThumbnailUrl(event.target.value)}
            placeholder="s3://bucket/thumbnails/example.jpg"
          />
        </label>
        <button type="button" onClick={onLookup}>
          Find Original Image
        </button>
        {lookupResult && (
          <div className="selected-url">
            <strong>Full image URL</strong>
            <span>{lookupResult.file_url}</span>
            <MediaPreview url={lookupResult.file_url} alt={lookupResult.file_name} large />
          </div>
        )}
      </div>
      <ResponsePanel response={response} />
    </section>
  )
}

function ManageFiles({
  updateUrls,
  setUpdateUrls,
  updateTags,
  setUpdateTags,
  operation,
  setOperation,
  deleteUrls,
  setDeleteUrls,
  onUpdateTags,
  onDeleteFiles,
  response
}) {
  return (
    <>
      <section className="content-grid">
        <div className="card">
          <h2>Bulk Add / Remove Tags</h2>
          <label>
            URLs
            <textarea
              value={updateUrls}
              onChange={(event) => setUpdateUrls(event.target.value)}
              placeholder="One URL per line"
            />
          </label>
          <label>
            Tags
            <textarea
              value={updateTags}
              onChange={(event) => setUpdateTags(event.target.value)}
              placeholder="One tag per line"
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
          <button type="button" onClick={onUpdateTags}>
            Submit
          </button>
        </div>

        <div className="card">
          <h2>Delete Files</h2>
          <label>
            URLs
            <textarea
              value={deleteUrls}
              onChange={(event) => setDeleteUrls(event.target.value)}
              placeholder="One URL per line"
            />
          </label>
          <button className="danger" type="button" onClick={onDeleteFiles}>
            Delete
          </button>
        </div>
      </section>
      <ResponsePanel response={response} />
    </>
  )
}

function Notifications({ email, setEmail, tag, setTag, onSubscribe, response }) {
  return (
    <section className="content-grid single">
      <div className="card">
        <h2>Subscribe Tag Notification</h2>
        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="student@example.com"
          />
        </label>
        <label>
          Tag
          <input
            value={tag}
            onChange={(event) => setTag(event.target.value)}
            placeholder="Koala"
          />
        </label>
        <button type="button" onClick={onSubscribe}>
          Subscribe
        </button>
      </div>
      <ResponsePanel response={response} />
    </section>
  )
}

function FullImageModal({ item, onClose }) {
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const dragStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 })

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

  const canPreview = isPreviewableUrl(item.file_url)
  const zoomImage = (delta) => {
    setZoom((currentZoom) => {
      const nextZoom = Math.min(4, Math.max(0.5, currentZoom + delta))

      if (nextZoom <= 1) {
        setPan({ x: 0, y: 0 })
      }

      return nextZoom
    })
  }
  const handleWheel = (event) => {
    if (!canPreview) {
      return
    }

    event.preventDefault()

    if (event.ctrlKey) {
      zoomImage(event.deltaY < 0 ? 0.25 : -0.25)
      return
    }

    zoomImage(event.deltaY < 0 ? 0.25 : -0.25)
  }
  const handlePointerDown = (event) => {
    if (!canPreview || zoom <= 1) {
      return
    }

    setIsDragging(true)
    dragStartRef.current = {
      x: event.clientX,
      y: event.clientY,
      panX: pan.x,
      panY: pan.y
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const handlePointerMove = (event) => {
    if (!isDragging) {
      return
    }

    const dragStart = dragStartRef.current
    setPan({
      x: dragStart.panX + event.clientX - dragStart.x,
      y: dragStart.panY + event.clientY - dragStart.y
    })
  }
  const stopDragging = () => setIsDragging(false)

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="full-image-preview-title"
      onClick={onClose}
    >
      <div className="modal-content" onClick={(event) => event.stopPropagation()}>
        <button className="modal-close" type="button" onClick={onClose} aria-label="Close preview">
          X
        </button>
        <div
          className={[
            'modal-preview',
            canPreview ? 'is-previewable' : '',
            zoom > 1 ? 'is-zoomed' : '',
            isDragging ? 'is-dragging' : ''
          ]
            .filter(Boolean)
            .join(' ')}
          onWheel={handleWheel}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={stopDragging}
          onPointerCancel={stopDragging}
        >
          <MediaPreview
            url={item.file_url}
            alt={item.file_name}
            large
            zoom={zoom}
            pan={pan}
            unavailableMessage="Full image cannot be previewed in browser because this is not an HTTPS URL."
          />
        </div>
        <div className="modal-details">
          <h2 id="full-image-preview-title">Full Image Preview</h2>
          <dl className="metadata-list">
            <div>
              <dt>File name</dt>
              <dd>{item.file_name}</dd>
            </div>
            <div>
              <dt>Tags</dt>
              <dd>{formatTags(item.tags)}</dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  )
}

function MediaPreview({
  url,
  alt,
  large = false,
  zoom = 1,
  pan = { x: 0, y: 0 },
  unavailableMessage = 'Browser cannot display this storage URL directly.'
}) {
  if (!isPreviewableUrl(url)) {
    return (
      <div className={large ? 'preview-fallback large' : 'preview-fallback'}>
        <strong>Preview unavailable</strong>
        <span>{unavailableMessage}</span>
        <code>{url || 'No URL provided'}</code>
      </div>
    )
  }

  return (
    <img
      className={large ? 'media-preview large' : 'media-preview'}
      src={url}
      alt={alt}
      style={
        large
          ? { transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }
          : undefined
      }
    />
  )
}

function ResponsePanel({ response, compact = false }) {
  return (
    <div className={compact ? 'response-panel compact' : 'response-panel'}>
      <h2>JSON Response</h2>
      <pre>{JSON.stringify(response, null, 2)}</pre>
    </div>
  )
}

function formatTags(tags) {
  return Object.entries(tags)
    .map(([tag, count]) => `${tag}: ${count}`)
    .join(', ')
}

export default App
