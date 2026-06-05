import { useEffect, useMemo, useState } from 'react'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { fromCognitoIdentityPool } from '@aws-sdk/credential-provider-cognito-identity'
import './App.css'

const API_BASE_URL = 'https://qpl03337ra.execute-api.ap-southeast-2.amazonaws.com'

const AWS_REGION = 'ap-southeast-2'
const S3_BUCKET = 'fit5225-a2-aussie-ecolens-media-group157'

const COGNITO_DOMAIN =
  'https://ap-southeast-2jx6dlawqs.auth.ap-southeast-2.amazoncognito.com'

const COGNITO_CLIENT_ID = '7dn8uiplfo2aj8fj0kdi4r2tcr'
const USER_POOL_ID = 'ap-southeast-2_jx6dlAwqs'
const IDENTITY_POOL_ID =
  'ap-southeast-2:86dc6553-312f-45d9-9f2c-fc513f79b6e6'

const REDIRECT_URI = 'http://localhost:5173'

const COGNITO_PROVIDER = `cognito-idp.${AWS_REGION}.amazonaws.com/${USER_POOL_ID}`

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
  const [currentPage, setCurrentPage] = useState('dashboard')

  const [idToken, setIdToken] = useState(() => localStorage.getItem('id_token') || '')
  const [accessToken, setAccessToken] = useState(
    () => localStorage.getItem('access_token') || ''
  )
  const [authUser, setAuthUser] = useState(() => {
    const stored = localStorage.getItem('auth_user')

    if (!stored) {
      return null
    }

    try {
      return JSON.parse(stored)
    } catch {
      return null
    }
  })

  const isAuthenticated = Boolean(idToken)

  const cognitoLoginUrl = useMemo(() => {
    const params = new URLSearchParams({
      client_id: COGNITO_CLIENT_ID,
      response_type: 'token',
      scope: 'openid email profile',
      redirect_uri: REDIRECT_URI
    })

    return `${COGNITO_DOMAIN}/login?${params.toString()}`
  }, [])

  const cognitoSignupUrl = useMemo(() => {
    const params = new URLSearchParams({
      client_id: COGNITO_CLIENT_ID,
      response_type: 'token',
      scope: 'openid email profile',
      redirect_uri: REDIRECT_URI
    })

    return `${COGNITO_DOMAIN}/signup?${params.toString()}`
  }, [])

  const cognitoLogoutUrl = useMemo(() => {
    const params = new URLSearchParams({
      client_id: COGNITO_CLIENT_ID,
      logout_uri: REDIRECT_URI
    })

    return `${COGNITO_DOMAIN}/logout?${params.toString()}`
  }, [])

  useEffect(() => {
    const hash = window.location.hash

    if (!hash || !hash.includes('id_token=')) {
      return
    }

    const params = new URLSearchParams(hash.replace(/^#/, ''))
    const newIdToken = params.get('id_token') || ''
    const newAccessToken = params.get('access_token') || ''
    const expiresIn = params.get('expires_in') || ''

    if (!newIdToken) {
      return
    }

    const decodedUser = decodeJwtPayload(newIdToken)

    localStorage.setItem('id_token', newIdToken)
    localStorage.setItem('access_token', newAccessToken)
    localStorage.setItem('token_expires_in', expiresIn)
    localStorage.setItem('auth_user', JSON.stringify(decodedUser))

    setIdToken(newIdToken)
    setAccessToken(newAccessToken)
    setAuthUser(decodedUser)
    setCurrentPage('dashboard')

    window.history.replaceState({}, document.title, window.location.pathname)
  }, [])

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

  const fileToBase64 = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader()

      reader.onload = () => {
        const result = reader.result
        const base64 = result.split(',')[1]
        resolve(base64)
      }

      reader.onerror = reject
      reader.readAsDataURL(file)
    })

  const callApi = async (endpoint, payload) => {
    setLoading(true)

    try {
      const headers = {
        'Content-Type': 'application/json'
      }

      if (idToken) {
        headers.Authorization = `Bearer ${idToken}`
      }

      const res = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers,
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

  const requireLogin = () => {
    if (!idToken) {
      setResponse({
        message: 'Please sign in with Cognito before using this feature.'
      })
      return false
    }

    return true
  }

  const handleSearchTags = () => {
    if (!requireLogin()) return

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
    if (!requireLogin()) return

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
    if (!requireLogin()) return

    if (!queryFile) {
      setResponse({ message: 'Please choose a query image or video first.' })
      return
    }

    const isImage = queryFile.type.startsWith('image/')
    const isVideo = queryFile.type.startsWith('video/')

    if (!isImage && !isVideo) {
      setResponse({
        message: 'Please choose an image or video file.',
        file_type: queryFile.type
      })
      return
    }

    if (isVideo && queryFile.size > 5 * 1024 * 1024) {
      setResponse({
        message:
          'The query video is too large for direct API upload. Please use a video smaller than 5 MB for query-by-upload, or use Upload Media for permanent video ingestion.',
        file_size_mb: (queryFile.size / (1024 * 1024)).toFixed(2)
      })
      return
    }

    setLoading(true)

    try {
      let payload
      let requestDetails

      if (isImage) {
        const compressedImage = await compressImageToBase64(queryFile)

        payload = {
          file_name: queryFile.name,
          file_type: 'image',
          image_base64: compressedImage.base64
        }

        requestDetails = {
          file_name: queryFile.name,
          file_type: 'image',
          image_base64: '[compressed base64 hidden in UI]',
          original_size_kb: Math.round(compressedImage.originalSize / 1024),
          compressed_size_kb: Math.round(compressedImage.compressedSize / 1024),
          compressed_width: compressedImage.width,
          compressed_height: compressedImage.height
        }
      } else {
        const videoBase64 = await fileToBase64(queryFile)

        payload = {
          file_name: queryFile.name,
          file_type: 'video',
          video_base64: videoBase64
        }

        requestDetails = {
          file_name: queryFile.name,
          file_type: 'video',
          video_base64: '[base64 hidden in UI]',
          original_size_kb: Math.round(queryFile.size / 1024)
        }
      }

      const headers = {
        'Content-Type': 'application/json'
      }

      if (idToken) {
        headers.Authorization = `Bearer ${idToken}`
      }

      const res = await fetch(`${API_BASE_URL}/query/by-upload`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      })

      const data = await res.json()

      setResponse({
        endpoint: '/query/by-upload',
        request: requestDetails,
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

  const handleUploadMedia = async () => {
    if (!requireLogin()) return

    if (!uploadMediaFile) {
      setResponse({ message: 'Please choose an image or video file first.' })
      return
    }

    if (
      !uploadMediaFile.type.startsWith('image/') &&
      !uploadMediaFile.type.startsWith('video/')
    ) {
      setResponse({
        message: 'Only image and video files are supported.',
        file_type: uploadMediaFile.type
      })
      return
    }

    setLoading(true)

    try {
      const credentials = fromCognitoIdentityPool({
        identityPoolId: IDENTITY_POOL_ID,
        logins: {
          [COGNITO_PROVIDER]: idToken
        },
        clientConfig: {
          region: AWS_REGION
        }
      })

      const s3Client = new S3Client({
        region: AWS_REGION,
        credentials
      })

      const safeName = safeFileName(uploadMediaFile.name)
      const shortId =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID().slice(0, 8)
          : String(Date.now())

      const objectKey = `uploads/${shortId}-${safeName}`
      const fileUrl = `s3://${S3_BUCKET}/${objectKey}`

      const fileBuffer = await uploadMediaFile.arrayBuffer()

      const command = new PutObjectCommand({
        Bucket: S3_BUCKET,
        Key: objectKey,
        Body: new Uint8Array(fileBuffer),
        ContentType: uploadMediaFile.type || 'application/octet-stream'
      })

      await s3Client.send(command)

      setResponse({
        endpoint: 'Cognito Identity Pool + S3 PutObject',
        status: 200,
        message:
          'Media uploaded to S3 successfully using Cognito temporary AWS credentials. The S3 trigger will process it with Lambda and Oracle ML shortly.',
        request: {
          file_name: uploadMediaFile.name,
          file_type: uploadMediaFile.type,
          file_size: uploadMediaFile.size
        },
        authentication: {
          user_pool: USER_POOL_ID,
          identity_pool: IDENTITY_POOL_ID,
          signed_in_email:
            authUser?.email || authUser?.username || authUser?.sub || 'Signed-in user'
        },
        bucket: S3_BUCKET,
        key: objectKey,
        file_url: fileUrl,
        next_step:
          'Wait a few seconds, then search by the detected species tag or check the matching results.'
      })
    } catch (error) {
      setResponse({
        endpoint: 'Cognito Identity Pool + S3 PutObject',
        message: 'S3 upload failed',
        error: String(error),
        troubleshooting:
          'Check Identity Pool authenticated role S3 permissions, User Pool ID, App client ID, token, and S3 CORS.'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleThumbnailLookup = () => {
    if (!requireLogin()) return

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
    if (!requireLogin()) return

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
    if (!requireLogin()) return

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
          <pre className="response-pre">
            {response.endpoint || 'No endpoint called yet'}
          </pre>
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

    if (response.endpoint === 'Cognito Identity Pool + S3 PutObject') {
      return (
        <div className="summary-card">
          <strong>{response.message || 'Upload completed.'}</strong>
          <span>File URL: {response.file_url || 'Not returned'}</span>
          <span>
            Upload used Cognito Identity Pool temporary AWS credentials. Backend
            processing may take a few seconds.
          </span>
        </div>
      )
    }

    if (response.endpoint === '/query/by-upload' && response.detected_tags) {
      return (
        <div className="summary-card">
          <strong>Query file processed without permanent UI storage.</strong>
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

  const handleSignIn = () => {
    window.location.href = cognitoLoginUrl
  }

  const handleSignUp = () => {
    window.location.href = cognitoSignupUrl
  }

  const handleLogout = () => {
    localStorage.removeItem('id_token')
    localStorage.removeItem('access_token')
    localStorage.removeItem('token_expires_in')
    localStorage.removeItem('auth_user')

    setIdToken('')
    setAccessToken('')
    setAuthUser(null)
    setResponse(initialResponse)
    setCurrentPage('dashboard')

    window.location.href = cognitoLogoutUrl
  }

  const renderLoginPage = () => (
    <main className="login-page">
      <section className="login-card">
        <p className="eyebrow">Aussie EcoLens</p>
        <h1>Sign in</h1>
        <p>
          Sign in or create an account through AWS Cognito to access the wildlife
          media search and management console.
        </p>

        <button type="button" onClick={handleSignIn}>
          Sign in with Cognito
        </button>

        <button type="button" onClick={handleSignUp}>
          Create account
        </button>

        <details className="developer-response">
          <summary>Authentication Details</summary>
          <div className="developer-note-body">
            <p>User Pool: {USER_POOL_ID}</p>
            <p>Identity Pool: {IDENTITY_POOL_ID}</p>
            <p>App client: {COGNITO_CLIENT_ID}</p>
          </div>
        </details>
      </section>
    </main>
  )

  const renderDashboard = () => (
    <section className="dashboard-page">
      <div className="dashboard-hero">
        <p className="eyebrow">AWS + Oracle wildlife media platform</p>
        <h1>Aussie EcoLens</h1>
        <p>
          Search, inspect, and manage wildlife media using Cognito authentication,
          AWS Lambda APIs, S3, DynamoDB, and Oracle ML detection.
        </p>

        {authUser && (
          <div className="summary-card">
            <strong>Signed in with Cognito</strong>
            <span>{authUser.email || authUser.username || authUser.sub}</span>
          </div>
        )}
      </div>

      <div className="dashboard-grid">
        <button type="button" className="dashboard-card" onClick={() => navigateTo('upload-media')}>
          <span>Upload Media</span>
          <p>Upload images and videos into S3 using Cognito temporary credentials.</p>
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
    <>
      <section className="page-panel">
        <p className="eyebrow">Permanent media ingestion</p>
        <h1>Upload Media</h1>
        <p className="page-subtitle">
          Add images or videos into the media database for future search.
        </p>

        <div className="notice-card">
          <strong>Upload Media uses Cognito Identity Pool temporary AWS credentials.</strong>
          <span>
            After upload, the existing S3 trigger processes the file, calls Oracle
            ML, creates metadata, and stores the record in DynamoDB.
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
                onChange={(event) =>
                  setUploadMediaFile(event.target.files[0] || null)
                }
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
                      The video will be uploaded to S3 uploads/. The backend
                      Lambda will process frames and call Oracle ML.
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <p className="helper-text">
                Choose an image or video file. After upload, wait a few seconds
                before searching for the detected species tag.
              </p>
            )}

            <button
              type="button"
              onClick={handleUploadMedia}
              disabled={!uploadMediaFile || loading}
            >
              {loading ? 'Uploading...' : 'Upload Media'}
            </button>

            <p className="helper-text">
              The file will be uploaded to S3 uploads/. Processing may take a few
              seconds before it appears in search results.
            </p>
          </div>

          <div className="workflow-card">
            <h2>Permanent Ingestion Workflow</h2>
            <ol className="workflow-list">
              <li>User signs in through Cognito User Pool</li>
              <li>User token is exchanged through Cognito Identity Pool</li>
              <li>Authenticated role provides temporary S3 upload permission</li>
              <li>Frontend uploads directly to S3 uploads/</li>
              <li>S3 triggers the upload-handler Lambda</li>
              <li>Oracle ML detects wildlife species</li>
              <li>Metadata, tags, checksum, and URLs are saved into DynamoDB</li>
              <li>Media becomes searchable in the UI</li>
            </ol>
          </div>
        </div>

        <details className="developer-response upload-notes">
          <summary>Developer Notes</summary>
          <div className="developer-note-body">
            <p>
              This page is different from Search By Uploaded File. Search By
              Uploaded File is a temporary query upload and does not permanently
              store the query image.
            </p>
            <p>
              Upload Media is permanent ingestion. It uploads the selected file to
              S3 uploads/ using Cognito Identity Pool temporary AWS credentials,
              then the existing S3-triggered Lambda runs checksum detection,
              thumbnail generation, Oracle ML detection, SNS notification, and
              DynamoDB insertion.
            </p>
          </div>
        </details>
      </section>

      {renderResponsePanel()}
    </>
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
            Upload a query image or a small query video. Image queries are compressed before sending. 
            Video queries are sent as a temporary API payload and are not permanently stored. 
            The system detects species tags using Oracle ML, then searches matching media from DynamoDB.
          </p>
          <label>
            Query image or video
            <input
              type="file"
              accept="image/*,video/*"
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
    if (currentPage === 'search-tags') return renderSearchTagsPage()
    if (currentPage === 'search-species') return renderSearchSpeciesPage()
    if (currentPage === 'upload-media') return renderUploadMediaPage()
    if (currentPage === 'search-upload') return renderSearchUploadPage()
    if (currentPage === 'thumbnail') return renderThumbnailPage()
    if (currentPage === 'management') return renderManagementPage()

    return renderDashboard()
  }

  if (!isAuthenticated) {
    return renderLoginPage()
  }

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="brand-block">
          <span>Aussie EcoLens</span>
          <small>Wildlife media console</small>
        </div>

        {authUser && (
          <div className="signed-in-box">
            <small>Signed in as</small>
            <span>{authUser.email || authUser.username || authUser.sub}</span>
          </div>
        )}

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
        ) : item.file_type === 'video' ? (
          <div className="thumbnail-fallback">
            <strong>Video preview available</strong>
            <span>Click Preview to open the video result.</span>
          </div>
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

function safeFileName(fileName) {
  if (!fileName) {
    return `upload-${Date.now()}`
  }

  return fileName.replace(/[^A-Za-z0-9._-]/g, '_')
}

function decodeJwtPayload(token) {
  try {
    const [, payload] = token.split('.')
    const normalisedPayload = payload.replace(/-/g, '+').replace(/_/g, '/')
    const decoded = atob(normalisedPayload)
    return JSON.parse(decoded)
  } catch {
    return {}
  }
}

export default App
