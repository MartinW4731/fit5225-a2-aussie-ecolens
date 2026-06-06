import { useEffect, useMemo, useRef, useState } from 'react'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { fromCognitoIdentityPool } from '@aws-sdk/credential-provider-cognito-identity'
import koalaPlaceholder from './assets/picture-koala.png'
import koalaSleepPlaceholder from './assets/koalasleep.png'
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
  const [tagQueries, setTagQueries] = useState([{ tag: '', count: 1 }])
  const [species, setSpecies] = useState('')
  const [thumbnailUrl, setThumbnailUrl] = useState('')
  const [queryFile, setQueryFile] = useState(null)
  const [uploadMediaFile, setUploadMediaFile] = useState(null)
  const [uploadMediaFiles, setUploadMediaFiles] = useState([])
  const [uploadProcessingResult, setUploadProcessingResult] = useState(null)
  const [uploadProcessingStatus, setUploadProcessingStatus] = useState('')
  const [uploadPreviewItems, setUploadPreviewItems] = useState([])
  const [uploadLightboxIndex, setUploadLightboxIndex] = useState(null)
  const [uploadToast, setUploadToast] = useState(null)
  const [uploadedMediaSignatures, setUploadedMediaSignatures] = useState([])
  const [uploadProcessedRecord, setUploadProcessedRecord] = useState(null)
  const [uploadMetadataStatus, setUploadMetadataStatus] = useState('idle')
  const [isUploadDetailsOpen, setIsUploadDetailsOpen] = useState(false)
  const uploadPollIdRef = useRef(0)

  const [updateUrls, setUpdateUrls] = useState('')
  const [updateTags, setUpdateTags] = useState('')
  const [operation, setOperation] = useState('Add')

  const [deleteUrls, setDeleteUrls] = useState('')
  const [responsesByPage, setResponsesByPage] = useState({})
  const [loadingByPage, setLoadingByPage] = useState({})
  const [selectedResult, setSelectedResult] = useState(null)
  const [currentPage, setCurrentPage] = useState('dashboard')
  const response = responsesByPage[currentPage] || initialResponse
  const loading = Boolean(loadingByPage[currentPage])
  const setPageResponse = (nextResponse, page = currentPage) => {
    setResponsesByPage((currentResponses) => ({
      ...currentResponses,
      [page]: nextResponse
    }))
  }
  const setResponse = setPageResponse
  const setPageLoading = (isLoading, page = currentPage) => {
    setLoadingByPage((currentLoading) => ({
      ...currentLoading,
      [page]: isLoading
    }))
  }
  const setLoading = setPageLoading

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
    if (uploadMediaFiles.length === 0) {
      setUploadPreviewItems([])
      return undefined
    }

    const previewItems = uploadMediaFiles.map((file) => ({
      file,
      previewUrl: URL.createObjectURL(file)
    }))

    setUploadPreviewItems(previewItems)

    return () => {
      previewItems.forEach((item) => URL.revokeObjectURL(item.previewUrl))
    }
  }, [uploadMediaFiles])

  useEffect(() => {
    if (uploadLightboxIndex === null) return undefined

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setUploadLightboxIndex(null)
      }

      if (event.key === 'ArrowLeft') {
        setUploadLightboxIndex((currentIndex) =>
          currentIndex === null
            ? currentIndex
            : (currentIndex - 1 + uploadPreviewItems.length) %
                uploadPreviewItems.length
        )
      }

      if (event.key === 'ArrowRight') {
        setUploadLightboxIndex((currentIndex) =>
          currentIndex === null
            ? currentIndex
            : (currentIndex + 1) % uploadPreviewItems.length
        )
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [uploadLightboxIndex, uploadPreviewItems.length])

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

  const parseTagSearchQuery = (value, fallbackCount) => {
    const tagObject = {}
    const conditions = value
      .split(/\n|\bAND\b/i)
      .map((item) => item.trim())
      .filter(Boolean)

    conditions.forEach((condition) => {
      const match = condition.match(/^(.+?)(?:\s*(?:>=|:|=)\s*(\d+))?$/)
      const tag = match?.[1]?.trim()
      const count = match?.[2]

      if (!tag) return

      tagObject[tag] = Number(count || fallbackCount) || 1
    })

    return tagObject
  }

  const formatTagSearchPayloadDescription = (tags) =>
    Object.entries(tags)
      .map(([tag, count]) => `${tag} >= ${count}`)
      .join(' AND ')

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

  const extractVideoFrameToBase64 = (file) =>
    new Promise((resolve, reject) => {
      const video = document.createElement('video')
      const objectUrl = URL.createObjectURL(file)

      video.preload = 'auto'
      video.muted = true
      video.playsInline = true
      video.crossOrigin = 'anonymous'
      video.src = objectUrl

      const captureFrameAt = (time) =>
        new Promise((resolveFrame, rejectFrame) => {
          video.onseeked = () => {
            try {
              const frameCanvas = document.createElement('canvas')
              frameCanvas.width = video.videoWidth || 800
              frameCanvas.height = video.videoHeight || 450

              const frameCtx = frameCanvas.getContext('2d')
              frameCtx.drawImage(video, 0, 0, frameCanvas.width, frameCanvas.height)

              resolveFrame(frameCanvas)
            } catch (error) {
              rejectFrame(error)
            }
          }

          video.currentTime = Math.min(time, Math.max(video.duration - 0.1, 0))
        })

      video.onloadedmetadata = async () => {
        try {
          const duration = video.duration || 1
          const percentages = [0.1, 0.25, 0.4, 0.55, 0.7, 0.85]

          const times = percentages.map((percentage) =>
            Math.max(0.1, duration * percentage)
          )

          const frames = []

          for (const time of times) {
            const frame = await captureFrameAt(time)
            frames.push(frame)
          }

          const frameWidth = frames[0]?.width || 800
          const frameHeight = frames[0]?.height || 450

          const outputWidth = frameWidth * 3
          const outputHeight = frameHeight * 2

          const canvas = document.createElement('canvas')
          canvas.width = outputWidth
          canvas.height = outputHeight

          const ctx = canvas.getContext('2d')

          frames.forEach((frame, index) => {
            const x = (index % 3) * frameWidth
            const y = Math.floor(index / 3) * frameHeight

            ctx.drawImage(frame, x, y, frameWidth, frameHeight)
          })

          const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
          const base64 = dataUrl.split(',')[1]

          URL.revokeObjectURL(objectUrl)

          resolve({
            base64,
            width: canvas.width,
            height: canvas.height,
            originalSize: file.size,
            frameSize: Math.round((base64.length * 3) / 4),
            extractedFrames: frames.length,
            extractedPercentages: percentages
          })
        } catch (error) {
          URL.revokeObjectURL(objectUrl)
          reject(error)
        }
      }

      video.onerror = () => {
        URL.revokeObjectURL(objectUrl)
        reject(new Error('Could not extract frames from the selected video.'))
      }
    })

  const callApi = async (endpoint, payload) => {
    const responsePage = currentPage
    setPageLoading(true, responsePage)

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

      setPageResponse({
        endpoint,
        request: payload,
        status: res.status,
        ...data
      }, responsePage)
    } catch (error) {
      setPageResponse({
        endpoint,
        request: payload,
        message: 'Request failed',
        error: String(error)
      }, responsePage)
    } finally {
      setPageLoading(false, responsePage)
    }
  }

 const pollUploadedFileProcessingResult = async (fileUrl, maxAttempts = 10) => {
  setUploadProcessingStatus('processing')
  setUploadProcessingResult(null)

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await new Promise((resolve) => setTimeout(resolve, 4000))

      const headers = {
        'Content-Type': 'application/json'
      }

      if (idToken) {
        headers.Authorization = `Bearer ${idToken}`
      }

      const res = await fetch(`${API_BASE_URL}/files/by-url`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          file_url: fileUrl
        })
      })

      const data = await res.json()

      if (data.found) {
        setUploadProcessingResult(data)
        setUploadProcessingStatus('completed')
        return data
      }

      setUploadProcessingStatus('processing')
    } catch (error) {
      console.error('Polling uploaded file result failed:', error)
    }
  }

  setUploadProcessingStatus('timeout')
  return null
} 

  const fetchApiData = async (endpoint, payload) => {
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

    if (!res.ok) {
      throw new Error(data.error || data.message || `Request failed with ${res.status}`)
    }

    return {
      status: res.status,
      ...data
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

    const finalTags = tagQueries.reduce((tags, query) => {
      const tag = query.tag.trim()

      if (!tag) return tags

      return {
        ...tags,
        [tag]: Number(query.count) || 1
      }
    }, {})

    if (Object.keys(finalTags).length === 0) {
      setResponse({ message: 'Please enter at least one tag.' })
      return
    }

    const payload = {
      tags: finalTags
    }

    console.log('Search By Tags AND query payload:', payload)
    console.log('Search By Tags AND query:', formatTagSearchPayloadDescription(finalTags))

    callApi('/query/by-tags', payload)
  }

  const updateTagQuery = (index, field, value) => {
    setTagQueries((currentQueries) =>
      currentQueries.map((query, queryIndex) =>
        queryIndex === index
          ? {
              ...query,
              [field]: value
            }
          : query
      )
    )
  }

  const addTagQuery = () => {
    setTagQueries((currentQueries) => [
      ...currentQueries,
      {
        tag: '',
        count: 1
      }
    ])
  }

  const removeTagQuery = (index) => {
    setTagQueries((currentQueries) =>
      currentQueries.length === 1
        ? currentQueries
        : currentQueries.filter((_, queryIndex) => queryIndex !== index)
    )
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
    const responsePage = currentPage

    if (!queryFile) {
      setPageResponse({ message: 'Please choose a query image or video first.' }, responsePage)
      return
    }

    const isImage = queryFile.type.startsWith('image/')
    const isVideo = queryFile.type.startsWith('video/')

    if (!isImage && !isVideo) {
      setPageResponse({
        message: 'Please choose an image or video file.',
        file_type: queryFile.type
      }, responsePage)
      return
    }

    if (isVideo && queryFile.size > 5 * 1024 * 1024) {
      setPageResponse({
        message:
          'The query video is too large for direct API upload. Please use a video smaller than 5 MB for query-by-upload, or use Upload Media for permanent video ingestion.',
        file_size_mb: (queryFile.size / (1024 * 1024)).toFixed(2)
      }, responsePage)
      return
    }

    setPageLoading(true, responsePage)

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
        const extractedFrame = await extractVideoFrameToBase64(queryFile)

        payload = {
          file_name: `${queryFile.name}-extracted-frame.jpg`,
          file_type: 'image',
          image_base64: extractedFrame.base64,
          query_source_type: 'video'
        }

        requestDetails = {
          file_name: queryFile.name,
          file_type: 'video',
          query_method: 'multi-frame video extraction',
          image_base64: '[extracted video frame sheet base64 hidden in UI]',
          original_size_kb: Math.round(extractedFrame.originalSize / 1024),
          extracted_frame_sheet_size_kb: Math.round(extractedFrame.frameSize / 1024),
          extracted_frame_sheet_width: extractedFrame.width,
          extracted_frame_sheet_height: extractedFrame.height,
          extracted_frames: extractedFrame.extractedFrames,
          extracted_percentages: extractedFrame.extractedPercentages
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

      setPageResponse({
        endpoint: '/query/by-upload',
        request: requestDetails,
        status: res.status,
        ...data
      }, responsePage)
    } catch (error) {
      setPageResponse({
        endpoint: '/query/by-upload',
        message: 'Uploaded file search failed',
        error: String(error)
      }, responsePage)
    } finally {
      setPageLoading(false, responsePage)
    }
  }

  const isDuplicateUploadResponse = (uploadResponse) => {
    const message = String(uploadResponse?.message || '').toLowerCase()
    const status = String(uploadResponse?.status || '').toLowerCase()

    return Boolean(
      uploadResponse?.duplicate ||
        uploadResponse?.isDuplicate ||
        uploadResponse?.skipped ||
        message.includes('duplicate') ||
        status.includes('duplicate') ||
        status.includes('skipped')
    )
  }

  const getUploadDuplicateKey = (file) => `${file.name}|${file.size}`

  const getRecordFileSize = (record) =>
    record.file_size ??
    record.fileSize ??
    record.size ??
    record.media?.file_size ??
    record.record?.file_size ??
    record.file?.file_size ??
    record.request?.file_size

  const isSameFileNameAndSize = (record, file) => {
    const recordFileName =
      record.file_name ||
      record.fileName ||
      record.name ||
      record.media?.file_name ||
      record.record?.file_name ||
      record.file?.file_name ||
      record.request?.file_name
    const recordFileSize = getRecordFileSize(record)

    return (
      recordFileName === file.name &&
      Number(recordFileSize) === Number(file.size)
    )
  }

  const checkUploadDuplicate = async (file) => {
    const duplicatePayload = {
      file_name: file.name,
      file_size: file.size
    }

    console.log('Upload duplicate check payload:', duplicatePayload)

    if (uploadedMediaSignatures.includes(getUploadDuplicateKey(file))) {
      console.log('Upload duplicate check response:', {
        source: 'frontend upload history',
        duplicate: true,
        skipped: true
      })
      console.log('Upload duplicate detected:', {
        source: 'frontend upload history',
        ...duplicatePayload
      })
      return true
    }

    try {
      const duplicateResponse = await fetchApiData('/query/by-tags', duplicatePayload)
      console.log('Upload duplicate check response:', duplicateResponse)

      const duplicateCandidates = collectMetadataCandidates(duplicateResponse)
      const duplicateRecord = duplicateCandidates.find((record) =>
        isSameFileNameAndSize(record, file)
      )

      if (duplicateRecord) {
        console.log('Upload duplicate detected:', duplicateRecord)
        return true
      }

      console.log('No duplicate found:', duplicatePayload)
      return false
    } catch (error) {
      console.error('Upload duplicate check failed. Continuing upload.', error)
      return false
    }
  }

  const recordHasProcessedMetadata = (record) =>
    Boolean(
      record &&
        ((record.tags && Object.keys(record.tags).length > 0) ||
          (record.confidence && Object.keys(record.confidence).length > 0) ||
          (record.confidence_scores && Object.keys(record.confidence_scores).length > 0) ||
          (Array.isArray(record.detected_species) && record.detected_species.length > 0) ||
          (Array.isArray(record.species) && record.species.length > 0))
    )

  const parseApiEnvelope = (data) => {
    if (typeof data?.body === 'string') {
      try {
        return {
          ...data,
          ...JSON.parse(data.body)
        }
      } catch {
        return data
      }
    }

    return data
  }

  const collectMetadataCandidates = (metadataResponse) => {
    const parsedResponse = parseApiEnvelope(metadataResponse)
    const candidateGroups = [
      parsedResponse.results,
      parsedResponse.items,
      parsedResponse.records,
      parsedResponse.media,
      parsedResponse.matches,
      parsedResponse.result ? [parsedResponse.result] : null,
      parsedResponse.record ? [parsedResponse.record] : null,
      parsedResponse.file_url ? [parsedResponse] : null
    ].filter(Boolean)

    return candidateGroups
      .flat()
      .filter(Boolean)
      .map((item) => ({
        ...item,
        ...(item.media || {}),
        ...(item.record || {}),
        ...(item.file || {}),
        tags:
          item.tags ||
          item.detected_tags ||
          item.detectedTags ||
          item.media?.tags ||
          item.record?.tags ||
          item.file?.tags ||
          {},
        confidence:
          item.confidence ||
          item.confidence_scores ||
          item.media?.confidence ||
          item.record?.confidence ||
          item.file?.confidence ||
          {}
      }))
  }

  const isUploadedMetadataRecord = (record, uploadResponse) => {
    const identifiers = [
      uploadResponse.file_url,
      uploadResponse.key,
      uploadResponse.request?.file_name,
      uploadResponse.thumbnail_url
    ].filter(Boolean)

    const recordValues = [
      record.file_url,
      record.original_url,
      record.media_url,
      record.s3_url,
      record.s3_key,
      record.key,
      record.file_name,
      record.thumbnail_url
    ].filter(Boolean)

    return identifiers.some((identifier) =>
      recordValues.some((value) => value === identifier)
    )
  }

  const pollUploadedMediaMetadata = async (uploadResponse) => {
    const pollId = uploadPollIdRef.current + 1
    uploadPollIdRef.current = pollId

    const lookupPayload = {
      file_url: uploadResponse.file_url,
      s3_key: uploadResponse.key,
      key: uploadResponse.key,
      file_name: uploadResponse.request?.file_name,
      thumbnail_url: uploadResponse.thumbnail_url
    }

    console.log('Upload metadata polling identifiers:', {
      file_url: uploadResponse.file_url,
      s3_key: uploadResponse.key,
      file_name: uploadResponse.request?.file_name,
      thumbnail_url: uploadResponse.thumbnail_url
    })
    console.log('Upload metadata polling request payload:', lookupPayload)

    setUploadProcessedRecord(null)
    setUploadMetadataStatus('polling')

    const maxAttempts = 11

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      if (attempt > 0) {
        await new Promise((resolve) => setTimeout(resolve, 3000))
      }

      if (uploadPollIdRef.current !== pollId) {
        return
      }

      try {
        const metadataResponse = await fetchApiData('/query/by-tags', lookupPayload)
        const metadataCandidates = collectMetadataCandidates(metadataResponse)
        const processedRecord = metadataCandidates.find((item) =>
          isUploadedMetadataRecord(item, uploadResponse)
        )

        console.log('Upload metadata polling response:', metadataResponse)
        console.log('Upload metadata matched record:', processedRecord || null)

        if (processedRecord) {
          if (uploadPollIdRef.current !== pollId) {
            return
          }

          setUploadProcessedRecord(processedRecord)

          if (recordHasProcessedMetadata(processedRecord)) {
            setUploadMetadataStatus('ready')
            return
          }
        }
      } catch (error) {
        console.error(error)
      }
    }

    if (uploadPollIdRef.current !== pollId) {
      return
    }

    setUploadMetadataStatus((currentStatus) =>
      currentStatus === 'ready' ? currentStatus : 'timeout'
    )
  }

  const handleUploadMedia = async () => {
    if (!requireLogin()) return
    const responsePage = currentPage

    if (!uploadMediaFile) {
      setPageResponse({ message: 'Please choose an image or video file first.' }, responsePage)
      return
    }

    if (
      !uploadMediaFile.type.startsWith('image/') &&
      !uploadMediaFile.type.startsWith('video/')
    ) {
      setPageResponse({
        message: 'Only image and video files are supported.',
        file_type: uploadMediaFile.type
      }, responsePage)
      return
    }

    const isDuplicate = await checkUploadDuplicate(uploadMediaFile)

    if (isDuplicate) {
      setUploadToast({
        type: 'duplicate',
        title: 'Duplicate detected',
        message: 'This file has already been uploaded. Upload skipped.'
      })
      setPageResponse({
        endpoint: 'Frontend duplicate check',
        message: 'Duplicate detected, upload skipped.',
        request: {
          file_name: uploadMediaFile.name,
          file_size: uploadMediaFile.size
        },
        duplicate: true,
        skipped: true
      }, responsePage)
      setUploadMetadataStatus('idle')
      setUploadProcessedRecord(null)
      return
    }

    setPageLoading(true, responsePage)
    setUploadToast(null)
    setUploadProcessingResult(null)
    setUploadProcessingStatus('processing')

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

      const uploadResponse = {
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
      }
      setResponse(uploadResponse)
      setPageResponse(uploadResponse, responsePage)
      setIsUploadDetailsOpen(false)
      setUploadedMediaSignatures((currentSignatures) => [
        ...new Set([
          ...currentSignatures,
          getUploadDuplicateKey(uploadMediaFile)
        ])
      ])
      pollUploadedFileProcessingResult(fileUrl)
      
      setUploadToast(
        isDuplicateUploadResponse(uploadResponse)
          ? {
              type: 'duplicate',
              title: 'Duplicate detected',
              message: 'This file has already been uploaded, so the upload was skipped.'
            }
          : {
              type: 'success',
              title: 'Upload successful',
              message:
                'Your media has been uploaded and is being processed for species detection.'
            }
      )
      pollUploadedMediaMetadata(uploadResponse)
    } catch (error) {
      console.error(error)
      setPageResponse({
        endpoint: 'Cognito Identity Pool + S3 PutObject',
        message: 'S3 upload failed',
        error: String(error),
        troubleshooting:
          'Check Identity Pool authenticated role S3 permissions, User Pool ID, App client ID, token, and S3 CORS.'
      }, responsePage)
      setUploadToast(null)
      setUploadMetadataStatus('idle')
    } finally {
      setPageLoading(false, responsePage)
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

        {response.request?.original_size_kb && response.request?.compressed_size_kb && (
          <p>
            <strong>Image compression:</strong>{' '}
            {response.request.original_size_kb} KB →{' '}
            {response.request.compressed_size_kb} KB (
            {response.request.compressed_width} ×{' '}
            {response.request.compressed_height})
          </p>
        )}

        {response.request?.query_method === 'multi-frame video extraction' && (
          <p>
            <strong>Video query extraction:</strong>{' '}
            {response.request.extracted_frames} frames sampled across the video (
            {response.request.extracted_percentages
              ?.map((percentage) => `${Math.round(percentage * 100)}%`)
              .join(', ')}
            ), combined into one image sheet{' '}
            {response.request.extracted_frame_sheet_width} ×{' '}
            {response.request.extracted_frame_sheet_height}.
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

  const renderUploadSuccessCard = () => {
    if (
      response.endpoint !== 'Cognito Identity Pool + S3 PutObject' ||
      response.error ||
      isDuplicateUploadResponse(response)
    ) {
      return null
    }

    const uploadedFiles = response.uploaded_files || []
    const fileName =
      uploadedFiles.length > 1
        ? uploadedFiles.map((file) => file.file_name).join(', ')
        : response.request?.file_name || uploadMediaFile?.name || 'Not available'
    const fileType =
      uploadedFiles.length > 1
        ? [
            ...new Set(
              uploadedFiles.map((file) => file.file_type || 'Unknown media type')
            )
          ].join(', ')
        : response.request?.file_type || uploadMediaFile?.type || 'Unknown media type'
    const fileUrl =
      uploadedFiles.length > 1
        ? uploadedFiles.map((file) => file.file_url).join(', ')
        : response.file_url || 'Not returned'
    const processingStatus =
      uploadMetadataStatus === 'ready'
        ? 'Processed'
        : uploadMetadataStatus === 'timeout'
          ? 'Processing pending'
          : 'Processing pending'

    return (
      <div className="upload-success-card" role="status" aria-live="polite">
        <button
          type="button"
          className="upload-success-toggle"
          onClick={() => setIsUploadDetailsOpen((isOpen) => !isOpen)}
          aria-expanded={isUploadDetailsOpen}
        >
          <strong>Upload successful ✓</strong>
          <span>
            View details
            <span
              className={
                isUploadDetailsOpen
                  ? 'upload-success-chevron open'
                  : 'upload-success-chevron'
              }
              aria-hidden="true"
            >
              ▼
            </span>
          </span>
        </button>

        <div
          className={
            isUploadDetailsOpen
              ? 'upload-success-details open'
              : 'upload-success-details'
          }
        >
          <div className="upload-success-details-inner">
            <p>Upload successful. Processing has started.</p>

            <dl className="upload-success-list">
              <div>
                <dt>File name</dt>
                <dd>{fileName}</dd>
              </div>
              <div>
                <dt>File type</dt>
                <dd>{fileType}</dd>
              </div>
              <div>
                <dt>S3 URL</dt>
                <dd>{fileUrl}</dd>
              </div>
              <div>
                <dt>Processing status</dt>
                <dd>{processingStatus}</dd>
              </div>
            </dl>

            <p>
              Wait a few seconds, then verify this file using Search By Species or
              Search By Tags.
            </p>
          </div>
        </div>
      </div>
    )
  }

  const renderUploadNoticeCard = () => {
    if (response.endpoint === 'Cognito Identity Pool + S3 PutObject' && response.error) {
      return (
        <div className="error-panel">
          <strong>Upload failed</strong>
          <span>{response.error}</span>
        </div>
      )
    }

    if (!response.endpoint && response.message && response.message !== initialResponse.message) {
      return (
        <div className="summary-card upload-inline-notice">
          <strong>{response.message}</strong>
        </div>
      )
    }

    return null
  }

  const getUploadSpecies = () => {
    const metadataSource = uploadProcessedRecord || response
    const speciesFields = [
      metadataSource.detected_species,
      metadataSource.species,
      metadataSource.label,
      metadataSource.detectedSpecies
    ]

    return speciesFields.flatMap((value) => {
      if (!value) return []
      if (Array.isArray(value)) return value
      if (typeof value === 'object') return Object.keys(value)
      return [String(value)]
    })
  }

  const formatSpeciesDisplayName = (value) =>
    String(value)
      .replace(/_/g, ' ')
      .trim()
      .replace(/^./, (character) => character.toUpperCase())

  const getUploadTagEntries = () => {
    const metadataSource = uploadProcessedRecord || response
    const tagFields = [
      metadataSource.tags,
      metadataSource.detected_tags,
      metadataSource.detectedTags
    ]

    return tagFields.flatMap((value) => {
      if (!value) return []
      if (Array.isArray(value)) {
        return value.map((tag) => [String(tag), 1])
      }
      if (typeof value === 'object') {
        return Object.entries(value).map(([tag, count]) => [String(tag), count])
      }
      return [[String(value), 1]]
    })
  }

  const getUploadConfidenceEntries = () => {
    const metadataSource = uploadProcessedRecord || response
    const confidence = metadataSource.confidence || metadataSource.confidence_scores || {}

    if (!confidence || typeof confidence !== 'object' || Array.isArray(confidence)) {
      return []
    }

    return Object.entries(confidence)
  }

  const formatConfidenceValue = (value) => {
    return String(value)
  }

  const renderUploadDetectionSummary = () => {
  if (
    response.endpoint !== 'Cognito Identity Pool + S3 PutObject' ||
    response.error ||
    isDuplicateUploadResponse(response)
  ) {
    return null
  }

  const metadataSource = uploadProcessingResult || uploadProcessedRecord || response

  const tags =
    metadataSource.tags ||
    metadataSource.detected_tags ||
    metadataSource.detectedTags ||
    {}

  const confidence =
    metadataSource.confidence ||
    metadataSource.confidence_scores ||
    {}

  const tagEntries = Object.entries(tags)
  const confidenceEntries = Object.entries(confidence)

  const speciesValues = [
    ...new Set(
      [
        ...(Array.isArray(metadataSource.detected_species)
          ? metadataSource.detected_species
          : []),
        ...(Array.isArray(metadataSource.species)
          ? metadataSource.species
          : []),
        ...tagEntries
          .filter(([, count]) => Number(count) > 0)
          .map(([tag]) => tag)
      ].filter(Boolean)
    )
  ]

  const hasRealMetadata =
    Boolean(uploadProcessingResult) ||
    speciesValues.length > 0 ||
    tagEntries.length > 0 ||
    confidenceEntries.length > 0

  const isProcessingTimeout =
    uploadProcessingStatus === 'timeout' ||
    (uploadMetadataStatus === 'timeout' && !hasRealMetadata)

  const isProcessingMetadata = !hasRealMetadata && !isProcessingTimeout

  const framesProcessed =
    Number(metadataSource.frames_processed || metadataSource.framesProcessed || 0)

  const renderLoadingLine = (label) => (
    <div className="upload-loading-row" key={label}>
      <span className="upload-mini-spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  )

  return (
    <div className="upload-detection-card">
      <div>
        <h3>Processing status</h3>
        <div className="upload-chip-list">
          {hasRealMetadata ? (
            <span>Processing complete</span>
          ) : isProcessingTimeout ? (
            <span className="warning-chip">
              Processing is taking longer than expected.
            </span>
          ) : (
            <span className="processing-chip">
              <span className="upload-mini-spinner" aria-hidden="true" />
              Processing wildlife detection...
            </span>
          )}
        </div>
      </div>

      {isProcessingMetadata ? (
        <div className="upload-loading-list" aria-live="polite">
          {[
            'Detecting species...',
            'Generating tags...',
            'Calculating confidence...'
          ].map(renderLoadingLine)}
        </div>
      ) : isProcessingTimeout ? (
        <div className="upload-processing-warning">
          Processing is taking longer than expected. Please verify the result
          later using Search By Tags or Search By Species.
        </div>
      ) : (
        <>
          <div>
            <h3>Detected species</h3>
            <div className="upload-chip-list">
              {speciesValues.length > 0 ? (
                speciesValues.map((value) => (
                  <span key={value}>{formatSpeciesDisplayName(value)}</span>
                ))
              ) : (
                <span className="neutral-chip">No species detected</span>
              )}
            </div>
          </div>

          {framesProcessed > 0 && (
            <div>
              <h3>Frames processed</h3>
              <div className="upload-chip-list">
                <span>{framesProcessed}</span>
              </div>
            </div>
          )}

          <div>
            <h3>Tags</h3>
            <div className="upload-chip-list">
              {tagEntries.length > 0 ? (
                tagEntries.map(([tag, count]) => (
                  <span key={tag}>
                    {tag} ({count})
                  </span>
                ))
              ) : (
                <span className="neutral-chip">No tags returned</span>
              )}
            </div>
          </div>

          <div>
            <h3>Confidence</h3>
            <div className="upload-chip-list">
              {confidenceEntries.length > 0 ? (
                confidenceEntries.map(([tag, value]) => (
                  <span key={tag}>
                    {tag}: {formatConfidenceValue(value)}
                  </span>
                ))
              ) : (
                <span className="neutral-chip">No confidence values returned</span>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

  const renderUploadLightbox = () => {
    if (uploadLightboxIndex === null || uploadPreviewItems.length === 0) {
      return null
    }

    const item = uploadPreviewItems[uploadLightboxIndex]
    const hasMultipleItems = uploadPreviewItems.length > 1

    return (
      <div
        className="media-lightbox"
        role="dialog"
        aria-modal="true"
        onClick={() => setUploadLightboxIndex(null)}
      >
        <button
          type="button"
          className="lightbox-close"
          onClick={() => setUploadLightboxIndex(null)}
          aria-label="Close preview"
        >
          Close
        </button>

        {hasMultipleItems && (
          <button
            type="button"
            className="lightbox-nav lightbox-nav-left"
            onClick={(event) => {
              event.stopPropagation()
              setUploadLightboxIndex(
                (uploadLightboxIndex - 1 + uploadPreviewItems.length) %
                  uploadPreviewItems.length
              )
            }}
            aria-label="Previous media"
          >
            {'<'}
          </button>
        )}

        <div className="lightbox-content" onClick={(event) => event.stopPropagation()}>
          {item.file.type.startsWith('video/') ? (
            <video src={item.previewUrl} controls />
          ) : (
            <img src={item.previewUrl} alt={item.file.name} />
          )}
          <div className="lightbox-caption">
            <strong>{item.file.name}</strong>
            <span>
              {item.file.type || 'Unknown media type'} | {formatFileSize(item.file.size)}
            </span>
          </div>
        </div>

        {hasMultipleItems && (
          <button
            type="button"
            className="lightbox-nav lightbox-nav-right"
            onClick={(event) => {
              event.stopPropagation()
              setUploadLightboxIndex(
                (uploadLightboxIndex + 1) % uploadPreviewItems.length
              )
            }}
            aria-label="Next media"
          >
            {'>'}
          </button>
        )}
      </div>
    )
  }

  const renderUploadFeedbackOverlay = () => (
    <>
      {loading && (
        <div className="upload-feedback-overlay" role="status" aria-live="polite">
          <div className="upload-feedback-modal">
            <span className="spinner" aria-hidden="true" />
            <strong>Uploading and processing media...</strong>
            <p>Please wait while the file is uploaded and prepared for species detection.</p>
          </div>
        </div>
      )}

      {uploadToast && !loading && (
        <div
          className="upload-feedback-overlay"
          role="dialog"
          aria-modal="true"
          onClick={() => setUploadToast(null)}
        >
          <div
            className={`upload-feedback-modal upload-feedback-${uploadToast.type}`}
            onClick={(event) => event.stopPropagation()}
          >
            <strong>{uploadToast.title}</strong>
            <p>{uploadToast.message}</p>
            <button type="button" onClick={() => setUploadToast(null)}>
              OK
            </button>
          </div>
        </div>
      )}
    </>
  )

  const renderResponsePanel = ({
    showDetectedTags = false,
    showResults = false
  } = {}) => {
    const isPlaceholderResponse =
      !loading && !response.error && !hasApiResponse(response) && response.message

    return (
      <section
        className={
          isPlaceholderResponse
            ? 'response-section response-section-placeholder'
            : 'response-section'
        }
      >
        <div className="section-heading">
          <h2>Response</h2>
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

        {showResults && renderResults()}
        {renderFriendlySummary(showResults)}
        {showDetectedTags && renderDetectedTags()}
      </section>
    )
  }

  const renderFriendlySummary = (showResults) => {
    const results = normaliseResults()

    if (!hasApiResponse(response) && response.message) {
      return (
        <div className="summary-card summary-card-placeholder">
          <img
            className="response-placeholder-image"
            src={koalaSleepPlaceholder}
            alt=""
            aria-hidden="true"
          />
        </div>
      )
    }

    if (response.endpoint === '/tags/update') {
      return <UpdateSummary response={response} />
    }

    if (response.endpoint === '/files/delete') {
      return <DeleteSummary response={response} />
    }

    if (response.endpoint === 'Cognito Identity Pool + S3 PutObject') return null

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
          <div className="empty-results-visual">
            <img
              className="response-placeholder-image"
              src={koalaPlaceholder}
              alt=""
              aria-hidden="true"
            />
            <div className="empty-results-message">
              <strong>No matching media files found.</strong>
              <span>Try a different tag, species, uploaded file, or thumbnail URL.</span>
            </div>
          </div>
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
    setResponsesByPage({})
    setLoadingByPage({})
    setCurrentPage('dashboard')

    window.location.href = cognitoLogoutUrl
  }

  const renderLoginPage = () => (
    <main className="login-page">
      <section className="login-card">
        <p className="eyebrow">Aussie EcoLens</p>
        <h1>Sign in</h1>

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

        <p className="login-card-note">
          Sign in or create an account through AWS Cognito to access the wildlife
          media search and management console.
        </p>
      </section>
    </main>
  )

  const renderDashboard = () => (
    <section className="dashboard-page">
      <div className="dashboard-hero">
        <div>
          <p className="eyebrow">AWS + Oracle wildlife media platform</p>
          <h1>Welcome to Aussie EcoLens</h1>
          <p>
            Upload, search, inspect, and manage wildlife media from one desktop
            workspace.
          </p>
        </div>
      </div>

      <div className="dashboard-primary-grid">
        <button type="button" className="dashboard-card dashboard-card-large" onClick={() => navigateTo('upload-media')}>
          <span>Upload Media</span>
          <p>Add wildlife photos and videos, then track processing and detected tags.</p>
        </button>
        <button type="button" className="dashboard-card dashboard-card-large" onClick={() => navigateTo('search-upload')}>
          <span>Search By Uploaded File</span>
          <p>Use an image or video frame to detect species and find matching media.</p>
        </button>
      </div>

      <div className="dashboard-secondary-grid">
        <button type="button" className="dashboard-card" onClick={() => navigateTo('search-tags')}>
          <span>Search By Tags</span>
          <p>Find media where detected tags meet a minimum count.</p>
        </button>
        <button type="button" className="dashboard-card" onClick={() => navigateTo('search-species')}>
          <span>Search By Species</span>
          <p>Search for wildlife records by species tag.</p>
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

        <div className="upload-layout">
          <div className="form-card form-card-wide">
            <h2>Select Media</h2>

            <label className="upload-picker">
              <span>Choose Media Files</span>
              <small>Images and videos are supported</small>
              <input
                type="file"
                multiple
                accept="image/*,video/*"
                onChange={(event) => {
                  const selectedFiles = Array.from(event.target.files || [])
                  setUploadMediaFiles(selectedFiles)
                  setUploadMediaFile(selectedFiles[0] || null)
                  setUploadLightboxIndex(null)
                  setUploadToast(null)
                  setUploadProcessedRecord(null)
                  setUploadMetadataStatus('idle')
                  setUploadProcessingResult(null)
                  setUploadProcessingStatus('')
                  setIsUploadDetailsOpen(false)
                  uploadPollIdRef.current += 1
                  setResponse(initialResponse)
                }}
              />
            </label>

            {uploadPreviewItems.length > 0 ? (
              <>
                <div className="upload-preview-grid">
                  {uploadPreviewItems.map((item, index) => (
                    <button
                      type="button"
                      className="upload-preview-card"
                      key={`${item.file.name}-${item.file.size}-${index}`}
                      onClick={() => setUploadLightboxIndex(index)}
                    >
                      <span className="upload-preview-media">
                        {item.file.type.startsWith('video/') ? (
                          <video src={item.previewUrl} muted playsInline />
                        ) : (
                          <img src={item.previewUrl} alt="" />
                        )}
                      </span>
                      <span className="upload-preview-meta">
                        <strong>{item.file.name}</strong>
                        <span>{item.file.type || 'Unknown media type'}</span>
                        <span>{formatFileSize(item.file.size)}</span>
                      </span>
                    </button>
                  ))}
                </div>
                {uploadPreviewItems.length > 1 && (
                  <p className="helper-text">
                    Multiple files can be previewed here. Upload Media will upload
                    the first selected file.
                  </p>
                )}
              </>
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

            {renderUploadNoticeCard()}
          </div>

          <div className="upload-status-column">
            {renderUploadDetectionSummary() || (
              <div className="upload-placeholder-card">
                <h2>Processing status</h2>
                <p>Upload media to view detected species, tags, and confidence values.</p>
              </div>
            )}
          </div>

          <div className="upload-summary-column">
            {renderUploadSuccessCard() || (
              <div className="upload-placeholder-card">
                <h2>Latest upload</h2>
                <p>Upload details will appear here after the selected file reaches storage.</p>
              </div>
            )}

            <p className="helper-text">
              Processing may take a few seconds before the file appears in search
              results.
            </p>
          </div>
        </div>
      </section>
      {renderUploadLightbox()}
      {renderUploadFeedbackOverlay()}
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
        <div className="form-card search-tags-card">
          <div className="tag-query-list">
            {tagQueries.map((query, index) => (
              <div className="tag-query-row" key={index}>
                <label>
                  Tag
                  <input
                    value={query.tag}
                    onChange={(event) =>
                      updateTagQuery(index, 'tag', event.target.value)
                    }
                    placeholder="koala"
                  />
                </label>
                <label>
                  Minimum count
                  <input
                    type="number"
                    min="1"
                    value={query.count}
                    onChange={(event) =>
                      updateTagQuery(index, 'count', event.target.value)
                    }
                  />
                </label>
                <button
                  className="tag-query-remove"
                  type="button"
                  onClick={() => removeTagQuery(index)}
                  disabled={tagQueries.length === 1}
                  aria-label="Remove tag condition"
                >
                  −
                </button>
              </div>
            ))}
          </div>
          <div className="tag-query-actions">
            <button className="tag-query-add" type="button" onClick={addTagQuery}>
              + Add tag
            </button>
          </div>
          <p className="helper-text">
            Multiple tag conditions are matched with AND logic. Every tag must
            meet its minimum count.
          </p>
          <button className="tag-query-search" type="button" onClick={handleSearchTags}>
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
        <div className="form-card search-form-card">
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
        <div className="form-card form-card-wide search-upload-card">
          <h2>Select Media</h2>
          <p className="helper-text">
            Upload a query image or a small query video. Image queries are compressed before sending. 
            For video queries, the browser extracts one representative frame and sends that frame to Oracle ML. 
            The detected species tags are then used to search matching images and videos from DynamoDB.
          </p>
          <label className="upload-picker">
            <span>Choose Media Files</span>
            <small>Images and videos are supported</small>
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
        <div className="form-card form-card-wide search-form-card">
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
          <NavIcon page="logout" />
          <span>Logout</span>
        </button>
      </aside>

      <main className="page-shell">
        {currentPage !== 'dashboard' && (
          <button
            className="home-jump-button"
            type="button"
            onClick={() => navigateTo('dashboard')}
          >
            <NavIcon page="dashboard" />
            <span>Home</span>
          </button>
        )}
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
      <NavIcon page={page} />
      <span>{children}</span>
    </button>
  )
}

function NavIcon({ page }) {
  const common = {
    className: 'nav-icon',
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '2.2',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': 'true'
  }

  if (page === 'dashboard') {
    return (
      <svg {...common}>
        <path d="M4 4h7v7H4z" />
        <path d="M13 4h7v7h-7z" />
        <path d="M4 13h7v7H4z" />
        <path d="M13 13h7v7h-7z" />
      </svg>
    )
  }

  if (page === 'upload-media') {
    return (
      <svg {...common}>
        <path d="M16 16l-4-4-4 4" />
        <path d="M12 12v8" />
        <path d="M20 16.5a4.5 4.5 0 0 0-3.9-6.7A6 6 0 0 0 4.8 8.2 4.5 4.5 0 0 0 5.5 17H7" />
      </svg>
    )
  }

  if (page === 'search-tags') {
    return (
      <svg {...common}>
        <path d="M20.6 13.3 13.3 20.6a2 2 0 0 1-2.8 0L3.4 13.5A2 2 0 0 1 2.8 12V4.8a2 2 0 0 1 2-2H12a2 2 0 0 1 1.4.6l7.2 7.1a2 2 0 0 1 0 2.8Z" />
        <path d="M7.5 7.5h.01" />
      </svg>
    )
  }

  if (page === 'search-species') {
    return (
      <svg {...common}>
        <circle cx="6.5" cy="10" r="1.8" />
        <circle cx="10" cy="6.8" r="1.8" />
        <circle cx="14" cy="6.8" r="1.8" />
        <circle cx="17.5" cy="10" r="1.8" />
        <path d="M7.8 16.8c.9-3.4 2.4-5.1 4.2-5.1s3.3 1.7 4.2 5.1c.5 1.9-.8 3.2-2.5 2.5a4.8 4.8 0 0 0-3.4 0c-1.7.7-3-.6-2.5-2.5Z" />
      </svg>
    )
  }

  if (page === 'search-upload') {
    return (
      <svg {...common}>
        <path d="M6 3h9l3 3v15H6z" />
        <path d="M14 3v4h4" />
        <circle cx="11" cy="13" r="2.4" />
        <path d="m13 15 2.2 2.2" />
      </svg>
    )
  }

  if (page === 'thumbnail') {
    return (
      <svg {...common}>
        <path d="M4 4h6v6H4z" />
        <path d="M14 4h6v6h-6z" />
        <path d="M4 14h6v6H4z" />
        <path d="M14 14h6v6h-6z" />
      </svg>
    )
  }

  if (page === 'management') {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.8 1.8 0 0 0 .4 2l.1.1-2.1 2.1-.1-.1a1.8 1.8 0 0 0-2-.4 1.8 1.8 0 0 0-1.1 1.7v.2h-3v-.2a1.8 1.8 0 0 0-1.2-1.7 1.8 1.8 0 0 0-2 .4l-.1.1-2.1-2.1.1-.1a1.8 1.8 0 0 0 .4-2 1.8 1.8 0 0 0-1.7-1.1h-.2v-3h.2a1.8 1.8 0 0 0 1.7-1.2 1.8 1.8 0 0 0-.4-2l-.1-.1 2.1-2.1.1.1a1.8 1.8 0 0 0 2 .4 1.8 1.8 0 0 0 1.2-1.7v-.2h3v.2a1.8 1.8 0 0 0 1.1 1.7 1.8 1.8 0 0 0 2-.4l.1-.1 2.1 2.1-.1.1a1.8 1.8 0 0 0-.4 2 1.8 1.8 0 0 0 1.7 1.2h.2v3h-.2a1.8 1.8 0 0 0-1.7 1.1Z" />
      </svg>
    )
  }

  return (
    <svg {...common}>
      <path d="M10 17H5V7h5" />
      <path d="m15 7 5 5-5 5" />
      <path d="M20 12H9" />
    </svg>
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
          <img
            className="thumbnail-placeholder-image"
            src={koalaPlaceholder}
            alt="Preview placeholder"
          />
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
