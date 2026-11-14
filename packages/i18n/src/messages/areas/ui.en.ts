/** Text inside shared web-ui components (uploader, media preview, dialog, toast). */
export const uiEn = {
  // What a failed request says when the server sent no message of its own
  'ui.error.generic': 'Something went wrong. Try again.',
  'ui.error.unreachable': 'Cannot reach the Elevate API. Is it running?',

  // Icon buttons: the close button of a dialog, the dismiss button of a toast
  'ui.close': 'Close',
  // The button that opens the navigation drawer on a phone
  'ui.menu.open': 'Open menu',
  'ui.dismiss': 'Dismiss',

  // MediaUploader: the drop zone, by kind of file
  'ui.upload.video': 'Upload video',
  'ui.upload.audio': 'Upload audio',
  'ui.upload.image': 'Upload image',
  'ui.upload.document': 'Upload document',
  'ui.upload.preparing': 'Preparing upload…',
  'ui.upload.uploading': 'Uploading {percent}%',
  'ui.upload.toVideoPipeline': 'Uploading to the video pipeline…',
  'ui.upload.processing': 'Processing…',
  'ui.upload.processing.hint': 'Transcoding usually takes a minute or two.',
  'ui.upload.failed': 'Upload failed',
  'ui.upload.processingFailed': 'Processing failed',
  'ui.upload.retry': 'Click to try again',
  // MediaUploader: a file that is already there
  'ui.upload.replace': 'Replace',
  'ui.upload.ready': 'Ready',
  // The length of a video or audio file
  'ui.upload.minutes': '{count} min',
  'ui.mediaStatus.pending': 'Pending',
  'ui.mediaStatus.processing': 'Processing',
  'ui.mediaStatus.ready': 'Ready',
  'ui.mediaStatus.errored': 'Errored',

  // MediaPreview: the link shown for a file that cannot be played or shown in place
  'ui.media.openDocument': 'Open document',
} as const
