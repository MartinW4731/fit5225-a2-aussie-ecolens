import { useState } from 'react'

const API_BASE_URL = 'https://qpl03337ra.execute-api.ap-southeast-2.amazonaws.com'

const initialResponse = {
  message: 'No request submitted yet'
}

function App() {
  const [tagName, setTagName] = useState('')
  const [minimumCount, setMinimumCount] = useState(1)
  const [species, setSpecies] = useState('')
  const [thumbnailUrl, setThumbnailUrl] = useState('')
  const [updateUrls, setUpdateUrls] = useState('')
  const [updateTags, setUpdateTags] = useState('')
  const [operation, setOperation] = useState('Add')
  const [deleteUrls, setDeleteUrls] = useState('')
  const [email, setEmail] = useState('')
  const [subscribeTag, setSubscribeTag] = useState('')
  const [response, setResponse] = useState(initialResponse)
  const [loading, setLoading] = useState(false)

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

  const handleSubscribe = () => {
    setResponse({
      endpoint: 'Subscribe Tag Notification',
      message:
        'SNS email notification is already configured in the backend. When uploaded media contains watched tags, AWS SNS automatically sends an email.',
      current_backend_watched_tags: [
        'canis_familiaris',
        'chalcophaps_longirostris',
        'thylogale_stigmatica',
        'Casuarius_casuarius'
      ],
      note:
        'This UI field is kept for demonstration only. A dynamic subscription API has not been implemented yet.',
      input_email: email,
      input_tag: subscribeTag
    })
  }

  const renderResults = () => {
    const results = response.results

    if (!Array.isArray(results) || results.length === 0) {
      return null
    }

    return (
      <div style={styles.resultsGrid}>
        {results.map((item, index) => (
          <div key={item.file_id || index} style={styles.card}>
            <h3 style={styles.cardTitle}>{item.file_name}</h3>

            <p>
              <strong>Type:</strong> {item.file_type}
            </p>

            {item.file_type === 'image' && item.thumbnail_presigned_url && (
              <img
                src={item.thumbnail_presigned_url}
                alt={item.file_name}
                style={styles.thumbnail}
              />
            )}

            {item.file_type === 'video' && (
              <p style={styles.videoLabel}>Video file</p>
            )}

            {item.file_presigned_url && (
              <a
                href={item.file_presigned_url}
                target="_blank"
                rel="noreferrer"
                style={styles.linkButton}
              >
                Open full {item.file_type || 'file'}
              </a>
            )}

            <p>
              <strong>S3 URL:</strong>
            </p>
            <pre style={styles.smallPre}>{item.file_url || ''}</pre>

            <p>
              <strong>Tags:</strong>
            </p>
            <pre style={styles.smallPre}>
              {JSON.stringify(item.tags || {}, null, 2)}
            </pre>

            <p>
              <strong>Confidence:</strong>
            </p>
            <pre style={styles.smallPre}>
              {JSON.stringify(item.confidence || {}, null, 2)}
            </pre>

            <p>
              <strong>Frames processed:</strong> {item.frames_processed || 0}
            </p>
          </div>
        ))}
      </div>
    )
  }

  return (
    <main style={styles.page}>
      <h1 style={styles.title}>Aussie EcoLens</h1>
      <p style={styles.subtitle}>
        Multi-cloud wildlife media search and management demo
      </p>

      <div style={styles.grid}>
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Search By Tags</h2>
          <label style={styles.label}>
            Tag name
            <input
              style={styles.input}
              value={tagName}
              onChange={(event) => setTagName(event.target.value)}
              placeholder="thylogale_stigmatica"
            />
          </label>
          <label style={styles.label}>
            Minimum count
            <input
              style={styles.input}
              type="number"
              min="1"
              value={minimumCount}
              onChange={(event) => setMinimumCount(event.target.value)}
            />
          </label>
          <button style={styles.button} type="button" onClick={handleSearchTags}>
            Search
          </button>
        </section>

        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Search By Species</h2>
          <label style={styles.label}>
            Species
            <input
              style={styles.input}
              value={species}
              onChange={(event) => setSpecies(event.target.value)}
              placeholder="canis_familiaris"
            />
          </label>
          <button
            style={styles.button}
            type="button"
            onClick={handleSearchSpecies}
          >
            Search
          </button>
        </section>

        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Get Image By Thumbnail</h2>
          <label style={styles.label}>
            Thumbnail URL
            <input
              style={styles.input}
              value={thumbnailUrl}
              onChange={(event) => setThumbnailUrl(event.target.value)}
              placeholder="s3://fit5225-a2-aussie-ecolens-media-group157/thumbnails/Thylogale_stigmatica_1.JPG"
            />
          </label>
          <button
            style={styles.button}
            type="button"
            onClick={handleThumbnailLookup}
          >
            Find
          </button>
        </section>

        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Update Tags</h2>
          <label style={styles.label}>
            URLs
            <textarea
              style={styles.textarea}
              value={updateUrls}
              onChange={(event) => setUpdateUrls(event.target.value)}
              placeholder="s3://fit5225-a2-aussie-ecolens-media-group157/uploads/Thylogale_stigmatica_1.JPG"
            />
          </label>
          <label style={styles.label}>
            Tags
            <textarea
              style={styles.textarea}
              value={updateTags}
              onChange={(event) => setUpdateTags(event.target.value)}
              placeholder="manual_checked"
            />
          </label>
          <label style={styles.label}>
            Operation
            <select
              style={styles.input}
              value={operation}
              onChange={(event) => setOperation(event.target.value)}
            >
              <option>Add</option>
              <option>Remove</option>
            </select>
          </label>
          <button style={styles.button} type="button" onClick={handleUpdateTags}>
            Submit
          </button>
        </section>

        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Delete Files</h2>
          <label style={styles.label}>
            URLs
            <textarea
              style={styles.textarea}
              value={deleteUrls}
              onChange={(event) => setDeleteUrls(event.target.value)}
              placeholder="Only use test files here. One URL per line."
            />
          </label>
          <button
            style={styles.dangerButton}
            type="button"
            onClick={handleDeleteFiles}
          >
            Delete
          </button>
        </section>

        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Subscribe Tag Notification</h2>
          <label style={styles.label}>
            Email
            <input
              style={styles.input}
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="student@example.com"
            />
          </label>
          <label style={styles.label}>
            Tag
            <input
              style={styles.input}
              value={subscribeTag}
              onChange={(event) => setSubscribeTag(event.target.value)}
              placeholder="canis_familiaris"
            />
          </label>
          <button style={styles.button} type="button" onClick={handleSubscribe}>
            Subscribe
          </button>
        </section>
      </div>

      <section style={styles.responseSection}>
        <h2 style={styles.sectionTitle}>Response</h2>
        {loading && <p>Loading...</p>}
        {renderResults()}
        <pre style={styles.pre}>{JSON.stringify(response, null, 2)}</pre>
      </section>
    </main>
  )
}

const styles = {
  page: {
    width: 'min(1180px, calc(100% - 32px))',
    margin: '0 auto',
    padding: '32px 0',
    color: '#1c2b25',
    fontFamily:
      'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
  },
  title: {
    margin: '0 0 6px',
    fontSize: '36px',
    fontWeight: 800,
    lineHeight: 1.1
  },
  subtitle: {
    margin: '0 0 24px',
    color: '#5d6d66'
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '16px',
    alignItems: 'start'
  },
  section: {
    display: 'grid',
    gap: '12px',
    padding: '18px',
    border: '1px solid #d7e1dc',
    borderRadius: '8px',
    background: '#ffffff'
  },
  responseSection: {
    display: 'grid',
    gap: '12px',
    marginTop: '16px',
    padding: '18px',
    border: '1px solid #d7e1dc',
    borderRadius: '8px',
    background: '#ffffff'
  },
  sectionTitle: {
    margin: 0,
    fontSize: '18px',
    lineHeight: 1.3
  },
  label: {
    display: 'grid',
    gap: '6px',
    fontSize: '14px',
    fontWeight: 700
  },
  input: {
    width: '100%',
    boxSizing: 'border-box',
    padding: '10px 12px',
    border: '1px solid #b9c8c1',
    borderRadius: '6px',
    color: '#1c2b25',
    background: '#fbfdfc',
    font: 'inherit'
  },
  textarea: {
    width: '100%',
    minHeight: '88px',
    boxSizing: 'border-box',
    padding: '10px 12px',
    border: '1px solid #b9c8c1',
    borderRadius: '6px',
    color: '#1c2b25',
    background: '#fbfdfc',
    font: 'inherit',
    resize: 'vertical'
  },
  button: {
    justifySelf: 'start',
    padding: '10px 14px',
    border: '1px solid #1f6f50',
    borderRadius: '6px',
    color: '#ffffff',
    background: '#1f6f50',
    font: 'inherit',
    fontWeight: 800,
    cursor: 'pointer'
  },
  dangerButton: {
    justifySelf: 'start',
    padding: '10px 14px',
    border: '1px solid #a43f35',
    borderRadius: '6px',
    color: '#ffffff',
    background: '#a43f35',
    font: 'inherit',
    fontWeight: 800,
    cursor: 'pointer'
  },
  pre: {
    margin: 0,
    minHeight: '160px',
    overflow: 'auto',
    padding: '14px',
    borderRadius: '6px',
    color: '#eef7f1',
    background: '#17352a',
    fontSize: '13px',
    lineHeight: 1.5
  },
  resultsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
    gap: '14px'
  },
  card: {
    padding: '14px',
    border: '1px solid #d7e1dc',
    borderRadius: '8px',
    background: '#f8fbf9'
  },
  cardTitle: {
    marginTop: 0
  },
  thumbnail: {
    width: '100%',
    maxWidth: '260px',
    borderRadius: '8px',
    border: '1px solid #cbd8d1'
  },
  videoLabel: {
    padding: '10px',
    borderRadius: '6px',
    background: '#e8f1ec',
    fontWeight: 700
  },
  linkButton: {
    display: 'inline-block',
    margin: '8px 0',
    padding: '8px 10px',
    borderRadius: '6px',
    background: '#1f6f50',
    color: '#ffffff',
    textDecoration: 'none',
    fontWeight: 700
  },
  smallPre: {
    maxHeight: '110px',
    overflow: 'auto',
    padding: '8px',
    borderRadius: '6px',
    background: '#edf3ef',
    fontSize: '12px',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-all'
  }
}

export default App
