export const en = {
  // App General
  'app.name': 'RecordFox',
  'app.tagline': 'Your DJ Sync Station',
  'app.selectPlaylistPrompt': 'Select a playlist or add a new one to view tracks.',

  // Mixer
  'mixer.show': 'Show Mixer',
  'mixer.hide': 'Hide Mixer',
  'mixer.center': 'CENTER',
  'mixer.master': 'MASTER',

  // Sidebar
  'sidebar.playlists': 'Playlists',
  'sidebar.loadingDetails': 'Loading playlist details...',
  'sidebar.noPlaylists': 'No Playlists',
  'sidebar.addNow': 'Add now',
  'sidebar.settings': 'Settings',

  // Add Playlist Modal
  'addPlaylist.title': 'Add YouTube Playlist',
  'addPlaylist.label': 'Playlist URL',
  'addPlaylist.placeholder': 'https://www.youtube.com/playlist?list=...',
  'addPlaylist.errorInvalidUrl':
    'Please enter a valid YouTube playlist URL (must contain "list=").',
  'addPlaylist.errorAddFailed': 'Error adding playlist.',
  'addPlaylist.cancel': 'Cancel',
  'addPlaylist.add': 'Add',
  'addPlaylist.loading': 'Loading...',

  // Settings Modal
  'settings.title': 'Settings',
  'settings.theme': 'Color Scheme',
  'settings.themeDark': 'Dark',
  'settings.themeLight': 'Light',
  'settings.downloadPathLabel': 'Playlist Storage Location',
  'settings.downloadPathSyncingTooltip': 'Location cannot be changed during synchronization',
  'settings.downloadPathSelectTooltip': 'Select another folder',
  'settings.downloadPathSelect': 'Select',
  'settings.downloadPathOpenTooltip': 'Open folder in Finder/Explorer',
  'settings.downloadPathOpen': 'Open',
  'settings.downloadPathSyncingWarning':
    '⚠️ The storage location cannot be changed during an active synchronization.',
  'settings.downloadPathHelp':
    'All MP3s and cover images of your YouTube playlists are saved here.',
  'settings.concurrentDownloads': 'Concurrent Downloads',
  'settings.workersCount': '{{count}} Workers',
  'settings.concurrentDownloadsHelp':
    'Sets how many tracks of a playlist are downloaded simultaneously (1 to 12).',
  'settings.languageLabel': 'Language',
  'settings.close': 'Close',
  'settings.errorChangePath': 'Error changing storage location.',
  'settings.errorChangeTheme': 'Error changing theme.',
  'settings.errorChangeWorkers': 'Error changing worker count.',
  'settings.errorChangeLanguage': 'Error changing language.',

  // Deck
  'deck.loadingWaveform': 'Decoding waveform...',
  'deck.noTrackLoaded': 'No track loaded',
  'deck.setCueTooltip': 'Set current position as Cue',
  'deck.autoloop': 'Autoloop (Beats)',

  // Track Row
  'track.waiting': 'Waiting...',
  'track.downloading': 'Downloading ({{percent}}%)',
  'track.queued': 'Queued...',

  // Tracklist
  'tracklist.usbExport': 'USB Export',
  'tracklist.searchPlaceholder': 'Search by title, artist...',
  'tracklist.colCover': 'Cover',
  'tracklist.colTitle': 'Title / Artist',
  'tracklist.colRating': 'Rating',
  'tracklist.colBpm': 'BPM',
  'tracklist.colKey': 'Key',
  'tracklist.colFormat': 'Format / Quality',
  'tracklist.colDuration': 'Duration',
  'tracklist.colLoadDeck': 'Load into Deck',
  'tracklist.noTracksFound': 'No tracks found',

  // USB Export Modal
  'usbExport.title': 'USB Export',
  'usbExport.playlistLabel': 'Playlist: {{title}}',
  'usbExport.scanning': 'Scanning for available USB drives...',
  'usbExport.noStickDetectedTitle': 'No USB drive detected',
  'usbExport.noStickDetectedDesc': 'Please connect a USB drive and make sure it is mounted.',
  'usbExport.singleDriveLabel': 'Detected USB Drive',
  'usbExport.multiDriveLabel': 'Select USB Drive',
  'usbExport.cancel': 'Cancel',
  'usbExport.scanAgain': 'Scan again',
  'usbExport.exportBtn': 'Export',
  'usbExport.playlistExistsTitle': 'Playlist already exists',
  'usbExport.playlistExistsDesc':
    'The playlist "{{title}}" already exists on the USB drive {{driveName}}. Do you want to overwrite it?',
  'usbExport.overwriteConfirm': 'Yes, overwrite',
  'usbExport.exporting': 'Exporting tracks...',
  'usbExport.preparing': 'Preparing...',
  'usbExport.initializing': 'Initializing export...',
  'usbExport.successTitle': 'Export complete!',
  'usbExport.successDesc':
    'The playlist was successfully exported in a Rekordbox-compatible structure to {{driveName}}.',
  'usbExport.doneBtn': 'Done',
  'usbExport.failedTitle': 'Export failed',
  'usbExport.failedError': 'Export failed.',
  'usbExport.closeBtn': 'Close',
  'usbExport.tryAgainBtn': 'Try again',
  'usbExport.errorScanDrives': 'Error scanning USB drives.',

  // Actions & Confirmations (useApp)
  'actions.confirmDeletePlaylist':
    'Do you really want to delete this playlist and all associated local MP3s?',
  'actions.errorDeletePlaylist': 'Error deleting: {{error}}',
  'actions.errorRenamePlaylist': 'Error renaming playlist: {{error}}',
  'actions.errorSyncPlaylist': 'Error syncing: {{error}}',
  'actions.errorUpdateSettings': 'Error updating settings: {{error}}',
  'actions.errorUpdateSettingsGeneral': 'Error updating settings.',
  'actions.successMigrate': 'Storage location successfully changed and files moved if applicable!',
  'actions.errorMigrate': 'Error migrating: {{error}}',
  'actions.errorMigrateGeneral': 'Error migrating.'
}
