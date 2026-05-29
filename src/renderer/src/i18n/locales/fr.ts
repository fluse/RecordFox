export const fr = {
  // App General
  'app.name': 'RecordFox',
  'app.tagline': 'Votre station de synchronisation DJ',
  'app.selectPlaylistPrompt':
    'Sélectionnez une playlist ou ajoutez-en une nouvelle pour voir les pistes.',

  // Mixer
  'mixer.show': 'Afficher le mixeur',
  'mixer.hide': 'Masquer le mixeur',
  'mixer.center': 'CENTER',
  'mixer.master': 'MASTER',

  // Sidebar
  'sidebar.playlists': 'Playlists',
  'sidebar.loadingDetails': 'Chargement des détails de la playlist...',
  'sidebar.noPlaylists': 'Aucune playlist',
  'sidebar.addNow': 'Ajouter maintenant',
  'sidebar.settings': 'Paramètres',

  // Add Playlist Modal
  'addPlaylist.title': 'Ajouter une playlist YouTube',
  'addPlaylist.label': 'URL de la playlist',
  'addPlaylist.placeholder': 'https://www.youtube.com/playlist?list=...',
  'addPlaylist.errorInvalidUrl':
    'Veuillez saisir une URL de playlist YouTube valide (doit contenir "list=").',
  'addPlaylist.errorAddFailed': "Erreur lors de l'ajout de la playlist.",
  'addPlaylist.cancel': 'Annuler',
  'addPlaylist.add': 'Ajouter',
  'addPlaylist.loading': 'Chargement...',

  // Settings Modal
  'settings.title': 'Paramètres',
  'settings.theme': 'Schéma de couleurs',
  'settings.themeDark': 'Sombre',
  'settings.themeLight': 'Clair',
  'settings.downloadPathLabel': 'Emplacement de stockage des playlists',
  'settings.downloadPathSyncingTooltip':
    "L'emplacement ne peut pas être modifié pendant la synchronisation",
  'settings.downloadPathSelectTooltip': 'Sélectionner un autre dossier',
  'settings.downloadPathSelect': 'Choisir',
  'settings.downloadPathOpenTooltip': 'Ouvrir le dossier dans le Finder/Explorateur',
  'settings.downloadPathOpen': 'Ouvrir',
  'settings.downloadPathSyncingWarning':
    "⚠️ L'emplacement de stockage ne peut pas être modifié pendant une synchronisation active.",
  'settings.downloadPathHelp':
    'Tous les MP3 et images de couverture de vos playlists YouTube sont enregistrés ici.',
  'settings.concurrentDownloads': 'Téléchargements simultanés',
  'settings.workersCount': '{{count}} Workers',
  'settings.concurrentDownloadsHelp':
    "Définit le nombre de pistes d'une playlist téléchargées simultanément (1 à 12).",
  'settings.languageLabel': 'Langue',
  'settings.close': 'Fermer',
  'settings.errorChangePath': "Erreur lors de la modification de l'emplacement.",
  'settings.errorChangeTheme': 'Erreur lors du changement de thème.',
  'settings.errorChangeWorkers': 'Erreur lors du changement du nombre de workers.',
  'settings.errorChangeLanguage': 'Erreur lors du changement de langue.',

  // Deck
  'deck.loadingWaveform': "Décodage de la forme d'onde...",
  'deck.noTrackLoaded': 'Aucune piste chargée',
  'deck.setCueTooltip': 'Définir la position actuelle comme Cue',
  'deck.autoloop': 'Autoloop (Beats)',

  // Track Row
  'track.waiting': 'Attente...',
  'track.downloading': 'Téléchargement ({{percent}}%)',
  'track.queued': 'En attente...',

  // Tracklist
  'tracklist.usbExport': 'Export USB',
  'tracklist.searchPlaceholder': 'Rechercher par titre, artiste...',
  'tracklist.colCover': 'Couverture',
  'tracklist.colTitle': 'Titre / Artiste',
  'tracklist.colRating': 'Rating',
  'tracklist.colBpm': 'BPM',
  'tracklist.colKey': 'Key',
  'tracklist.colFormat': 'Format / Qualité',
  'tracklist.colDuration': 'Durée',
  'tracklist.colLoadDeck': 'Charger dans le Deck',
  'tracklist.noTracksFound': 'Aucune piste trouvée',

  // USB Export Modal
  'usbExport.title': 'Export USB',
  'usbExport.playlistLabel': 'Playlist: {{title}}',
  'usbExport.scanning': 'Recherche de clés USB disponibles...',
  'usbExport.noStickDetectedTitle': 'Aucune clé USB détectée',
  'usbExport.noStickDetectedDesc':
    "Veuillez connecter une clé USB et vous assurer qu'elle est montée.",
  'usbExport.singleDriveLabel': 'Clé USB détectée',
  'usbExport.multiDriveLabel': 'Sélectionner la clé USB',
  'usbExport.cancel': 'Annuler',
  'usbExport.scanAgain': 'Rechercher à nouveau',
  'usbExport.exportBtn': 'Exporter',
  'usbExport.playlistExistsTitle': 'La playlist existe déjà',
  'usbExport.playlistExistsDesc':
    'La playlist "{{title}}" existe déjà sur la clé USB {{driveName}}. Voulez-vous la remplacer ?',
  'usbExport.overwriteConfirm': 'Oui, remplacer',
  'usbExport.exporting': 'Exportation des pistes...',
  'usbExport.preparing': 'Préparation...',
  'usbExport.initializing': "Initialisation de l'exportation...",
  'usbExport.successTitle': 'Exportation terminée !',
  'usbExport.successDesc':
    'La playlist a été transférée avec succès sur {{driveName}} dans une structure compatible Rekordbox.',
  'usbExport.doneBtn': 'Terminé',
  'usbExport.failedTitle': "L'exportation a échoué",
  'usbExport.failedError': "L'exportation a échoué.",
  'usbExport.closeBtn': 'Fermer',
  'usbExport.tryAgainBtn': 'Réessayer',
  'usbExport.errorScanDrives': 'Erreur lors de la recherche des clés USB.',

  // Actions & Confirmations (useApp)
  'actions.confirmDeletePlaylist':
    'Voulez-vous vraiment supprimer cette playlist et tous les fichiers MP3 locaux associés ?',
  'actions.errorDeletePlaylist': 'Erreur lors de la suppression: {{error}}',
  'actions.errorRenamePlaylist': 'Erreur lors du renommage de la playlist : {{error}}',
  'actions.errorSyncPlaylist': 'Erreur lors de la synchronisation: {{error}}',
  'actions.errorUpdateSettings': 'Erreur lors de la mise à jour des paramètres: {{error}}',
  'actions.errorUpdateSettingsGeneral': 'Erreur lors de la mise à jour des paramètres.',
  'actions.successMigrate':
    'Emplacement de stockage modifié avec succès et fichiers déplacés si nécessaire !',
  'actions.errorMigrate': 'Erreur lors de la migration: {{error}}',
  'actions.errorMigrateGeneral': 'Erreur lors de la migration.'
}
