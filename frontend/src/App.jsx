import { useState } from 'react'

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

  const splitLines = (value) =>
    value
      .split('\n')
      .map((item) => item.trim())
      .filter(Boolean)

  const handleSearchTags = () => {
    setResponse({
      endpoint: 'Search By Tags',
      request: {
        tags: {
          [tagName || 'Koala']: Number(minimumCount) || 1
        }
      },
      message: 'Fake search by tags response',
      count: 1,
      results: [
        {
          file_id: 'mock-file-001',
          file_name: 'koala.jpg',
          file_url: 's3://aussie-ecolens/uploads/koala.jpg',
          thumbnail_url: 's3://aussie-ecolens/thumbnails/koala.jpg',
          tags: {
            [tagName || 'Koala']: Number(minimumCount) || 1
          }
        }
      ]
    })
  }

  const handleSearchSpecies = () => {
    setResponse({
      endpoint: 'Search By Tags',
      request: {
        species: species || 'Koala'
      },
      message: 'Fake search by species response',
      count: 1,
      results: [
        {
          file_id: 'mock-file-002',
          file_name: 'species-match.jpg',
          file_url: 's3://aussie-ecolens/uploads/species-match.jpg',
          thumbnail_url: 's3://aussie-ecolens/thumbnails/species-match.jpg',
          tags: {
            [species || 'Koala']: 1
          }
        }
      ]
    })
  }

  const handleThumbnailLookup = () => {
    setResponse({
      endpoint: 'Get Image By Thumbnail',
      request: {
        thumbnail_url:
          thumbnailUrl || 's3://aussie-ecolens/thumbnails/example.jpg'
      },
      message: 'Fake thumbnail lookup response',
      thumbnail_url:
        thumbnailUrl || 's3://aussie-ecolens/thumbnails/example.jpg',
      file_url: 's3://aussie-ecolens/uploads/example.jpg',
      file_name: 'example.jpg',
      file_type: 'image/jpeg',
      tags: {
        Koala: 1
      }
    })
  }

  const handleUpdateTags = () => {
    setResponse({
      endpoint: 'Update Tags',
      request: {
        urls: splitLines(updateUrls),
        tags: splitLines(updateTags),
        operation: operation === 'Add' ? 1 : 0
      },
      message: 'Fake tag update response',
      operation: operation === 'Add' ? 1 : 0,
      updated_count: splitLines(updateUrls).length,
      updated_items: splitLines(updateUrls).map((url, index) => ({
        file_id: `mock-file-${index + 1}`,
        file_name: `mock-file-${index + 1}.jpg`,
        file_url: url,
        thumbnail_url: url.includes('/thumbnails/') ? url : '',
        updated_tags: Object.fromEntries(
          splitLines(updateTags).map((tag) => [tag, 1])
        )
      })),
      not_found: []
    })
  }

  const handleDeleteFiles = () => {
    setResponse({
      endpoint: 'Delete Files',
      request: {
        urls: splitLines(deleteUrls)
      },
      message: 'Fake delete files response',
      deleted_count: splitLines(deleteUrls).length,
      deleted_items: splitLines(deleteUrls).map((url, index) => ({
        file_id: `mock-file-${index + 1}`,
        file_name: `mock-file-${index + 1}.jpg`,
        deleted_s3_objects: [url],
        deleted_from_dynamodb: true
      })),
      not_found: [],
      errors: []
    })
  }

  const handleSubscribe = () => {
    setResponse({
      endpoint: 'Subscribe Tag',
      request: {
        email: email || 'student@example.com',
        tag: subscribeTag || 'Koala'
      },
      message: 'Subscription request sent',
      email: email || 'student@example.com',
      tag: subscribeTag || 'Koala',
      subscription_arn: 'pending confirmation'
    })
  }

  return (
    <main style={styles.page}>
      <h1 style={styles.title}>Aussie EcoLens</h1>

      <div style={styles.grid}>
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Search By Tags</h2>
          <label style={styles.label}>
            Tag name
            <input
              style={styles.input}
              value={tagName}
              onChange={(event) => setTagName(event.target.value)}
              placeholder="Koala"
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
              placeholder="Koala"
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
              placeholder="s3://bucket/thumbnails/example.jpg"
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
              placeholder="One URL per line"
            />
          </label>
          <label style={styles.label}>
            Tags
            <textarea
              style={styles.textarea}
              value={updateTags}
              onChange={(event) => setUpdateTags(event.target.value)}
              placeholder="One tag per line"
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
              placeholder="One URL per line"
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
              placeholder="Koala"
            />
          </label>
          <button style={styles.button} type="button" onClick={handleSubscribe}>
            Subscribe
          </button>
        </section>
      </div>

      <section style={styles.responseSection}>
        <h2 style={styles.sectionTitle}>Response</h2>
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
    margin: '0 0 24px',
    fontSize: '36px',
    fontWeight: 800,
    lineHeight: 1.1
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
  }
}

export default App
