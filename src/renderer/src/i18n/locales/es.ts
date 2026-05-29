export const es = {
  // App General
  'app.name': 'RecordFox',
  'app.tagline': 'Tu estación de sincronización DJ',
  'app.selectPlaylistPrompt':
    'Selecciona una lista de reproducción o añade una nueva para ver los temas.',

  // Mixer
  'mixer.show': 'Mostrar mezclador',
  'mixer.hide': 'Ocultar mezclador',
  'mixer.center': 'CENTER',
  'mixer.master': 'MASTER',

  // Sidebar
  'sidebar.playlists': 'Listas de reproducción',
  'sidebar.loadingDetails': 'Cargando detalles de la lista de reproducción...',
  'sidebar.noPlaylists': 'Sin listas de reproducción',
  'sidebar.addNow': 'Añadir ahora',
  'sidebar.settings': 'Ajustes',

  // Add Playlist Modal
  'addPlaylist.title': 'Añadir lista de reproducción de YouTube',
  'addPlaylist.label': 'URL de la lista de reproducción',
  'addPlaylist.placeholder': 'https://www.youtube.com/playlist?list=...',
  'addPlaylist.errorInvalidUrl':
    'Introduce una URL de lista de reproducción de YouTube válida (debe contener "list=").',
  'addPlaylist.errorAddFailed': 'Error al añadir la lista de reproducción.',
  'addPlaylist.cancel': 'Cancelar',
  'addPlaylist.add': 'Añadir',
  'addPlaylist.loading': 'Cargando...',

  // Settings Modal
  'settings.title': 'Ajustes',
  'settings.theme': 'Esquema de colores',
  'settings.themeDark': 'Oscuro',
  'settings.themeLight': 'Claro',
  'settings.downloadPathLabel': 'Lugar de almacenamiento de las listas',
  'settings.downloadPathSyncingTooltip':
    'El lugar de almacenamiento no se puede cambiar durante la sincronización',
  'settings.downloadPathSelectTooltip': 'Seleccionar otra carpeta',
  'settings.downloadPathSelect': 'Seleccionar',
  'settings.downloadPathOpenTooltip': 'Abrir carpeta en Finder/Explorador',
  'settings.downloadPathOpen': 'Abrir',
  'settings.downloadPathSyncingWarning':
    '⚠️ El lugar de almacenamiento no se puede cambiar durante una sincronización activa.',
  'settings.downloadPathHelp':
    'Todos los MP3 e imágenes de portada de tus listas de reproducción de YouTube se guardan aquí.',
  'settings.concurrentDownloads': 'Descargas simultáneas',
  'settings.workersCount': '{{count}} Workers',
  'settings.concurrentDownloadsHelp':
    'Establece cuántos temas de una lista se descargan simultáneamente (1 a 12).',
  'settings.languageLabel': 'Idioma',
  'settings.close': 'Cerrar',
  'settings.errorChangePath': 'Error al cambiar el lugar de almacenamiento.',
  'settings.errorChangeTheme': 'Error al cambiar el tema.',
  'settings.errorChangeWorkers': 'Error al cambiar la cantidad de workers.',
  'settings.errorChangeLanguage': 'Error al cambiar el idioma.',

  // Deck
  'deck.loadingWaveform': 'Decodificando forma de onda...',
  'deck.noTrackLoaded': 'Ningún tema cargado',
  'deck.setCueTooltip': 'Establecer posición actual como Cue',
  'deck.autoloop': 'Autoloop (Beats)',

  // Track Row
  'track.waiting': 'Esperando...',
  'track.downloading': 'Descargando ({{percent}}%)',
  'track.queued': 'En cola...',

  // Tracklist
  'tracklist.usbExport': 'Exportar USB',
  'tracklist.searchPlaceholder': 'Buscar por título, artista...',
  'tracklist.colPosition': '#',
  'tracklist.colCover': 'Portada',
  'tracklist.colTitle': 'Título / Artista',
  'tracklist.colRating': 'Rating',
  'tracklist.colBpm': 'BPM',
  'tracklist.colKey': 'Key',
  'tracklist.colFormat': 'Formato / Calidad',
  'tracklist.colDuration': 'Duración',
  'tracklist.colLoadDeck': 'Cargar en Deck',
  'tracklist.noTracksFound': 'No se encontraron temas',
  'tracklist.customizeColumns': 'Personalizar columnas',

  // USB Export Modal
  'usbExport.title': 'Exportar USB',
  'usbExport.playlistLabel': 'Lista de reproducción: {{title}}',
  'usbExport.scanning': 'Buscando memorias USB disponibles...',
  'usbExport.noStickDetectedTitle': 'No se ha detectado ninguna memoria USB',
  'usbExport.noStickDetectedDesc':
    'Por favor, conecta una memoria USB y asegúrate de que esté montada.',
  'usbExport.singleDriveLabel': 'Memoria USB detectada',
  'usbExport.multiDriveLabel': 'Seleccionar memoria USB',
  'usbExport.cancel': 'Cancelar',
  'usbExport.scanAgain': 'Buscar de nuevo',
  'usbExport.exportBtn': 'Exportar',
  'usbExport.playlistExistsTitle': 'La lista de reproducción ya existe',
  'usbExport.playlistExistsDesc':
    'La lista de reproducción "{{title}}" ya existe en la memoria USB {{driveName}}. ¿Quieres sobrescribirla?',
  'usbExport.overwriteConfirm': 'Sí, sobrescribir',
  'usbExport.exporting': 'Exportando temas...',
  'usbExport.preparing': 'Preparando...',
  'usbExport.initializing': 'Inicializando exportación...',
  'usbExport.successTitle': '¡Exportación completada!',
  'usbExport.successDesc':
    'La lista de reproducción se ha transferido correctamente a {{driveName}} en una estructura compatible con Rekordbox.',
  'usbExport.doneBtn': 'Hecho',
  'usbExport.failedTitle': 'Exportación fallida',
  'usbExport.failedError': 'Exportación fallida.',
  'usbExport.closeBtn': 'Cerrar',
  'usbExport.tryAgainBtn': 'Reintentar',
  'usbExport.errorScanDrives': 'Error al buscar memorias USB.',

  // Actions & Confirmations (useApp)
  'actions.confirmDeletePlaylist':
    '¿Realmente quieres borrar esta lista de reproducción y todos los archivos MP3 locales asociados?',
  'actions.errorDeletePlaylist': 'Error al borrar: {{error}}',
  'actions.errorRenamePlaylist': 'Error al renombrar la lista de reproducción: {{error}}',
  'actions.errorReorderTracks': 'Error al reordenar las pistas: {{error}}',
  'actions.errorSyncPlaylist': 'Error al sincronizar: {{error}}',
  'actions.errorUpdateSettings': 'Error al actualizar los ajustes: {{error}}',
  'actions.errorUpdateSettingsGeneral': 'Error al actualizar los ajustes.',
  'actions.successMigrate':
    '¡Lugar de almacenamiento cambiado con éxito y archivos movidos si correspondía!',
  'actions.errorMigrate': 'Error en la migración: {{error}}',
  'actions.errorMigrateGeneral': 'Error en la migración.'
}
