Class ("paella.PaellaPlayer", paella.PlayerBase,{
	player:null,

	selectedProfile:'',
	videoIdentifier:'',
	editor:null,
	loader:null,

	// Video data:
	videoData:null,

	setProfile:function(profileName,animate) {
		var thisClass = this;
		this.videoContainer.setProfile(profileName,function(newProfileName) {
			thisClass.selectedProfile = newProfileName;
		},animate);
	},

	initialize:function(playerId) {
		this.parent(playerId);

		// if initialization ok
		if (this.playerId==playerId) {
			this.loadPaellaPlayer();

			var thisClass = this;
			paella.events.bind(paella.events.setProfile,function(event,params) {
				thisClass.setProfile(params.profileName);
			});
		}
	},

	loadPaellaPlayer:function() {
		var thisClass = this;
		this.loader = new paella.LoaderContainer('paellaPlayer_loader');
		$('body')[0].appendChild(this.loader.domElement);
		paella.events.trigger(paella.events.loadStarted);

		paella.initDelegate.loadDictionary(function() {
			paella.initDelegate.loadConfig(function(config) {
				thisClass.onLoadConfig(config);
			});
		});
	},

	onLoadConfig:function(configData) {
		paella.data = new paella.Data(configData);

		this.config = configData;
		this.videoIdentifier = paella.initDelegate.getId();

		if (this.videoIdentifier) {
			if (this.mainContainer) {
				this.videoContainer = new paella.VideoContainer(this.playerId + "_videoContainer");
				this.mainContainer.appendChild(this.videoContainer.domElement);
			}
			$(window).resize(function(event) { paella.player.onresize(); });
			this.onload();
		}
	},

	onload:function() {
		var thisClass = this;
		this.accessControl.checkAccess(function(permissions) {
			var errorMessage;
			if (!permissions.loadError) {
				base.log.debug("read:" + permissions.canRead + ", contribute:" + permissions.canContribute + ", write:" + permissions.canWrite);
				if (permissions.canWrite) {
					//thisClass.setupEditor();
					paella.events.bind(paella.events.showEditor,function(event) { thisClass.showEditor(); });
					paella.events.bind(paella.events.hideEditor,function(event) { thisClass.hideEditor(); });
				}
				if (permissions.canRead) {
					thisClass.loadVideo();
					thisClass.videoContainer.publishVideo();
				}
				else {
					thisClass.unloadAll(base.dictionary.translate("You are not authorized to view this resource"));
				}
			}
			else if (permissions.isAnonymous) {
				errorMessage = base.dictionary.translate("You are not logged in");
				thisClass.unloadAll(errorMessage);
				paella.events.trigger(paella.events.error,{error:errorMessage});
			}
			else {
				errorMessage = base.dictionary.translate("You are not authorized to view this resource");
				thisClass.unloadAll(errorMessage);
				paella.events.trigger(paella.events.error,{error:errorMessage});
			}
		});
	},

	initVideoEvents:function() {
		var thisClass = this;
		paella.events.bind(paella.events.play,function(event) { thisClass.play(); });
		paella.events.bind(paella.events.pause,function(event) { thisClass.pause(); });
		paella.events.bind(paella.events.seekTo,function(event,params) { paella.player.videoContainer.seekTo(params.newPositionPercent); });
		paella.events.bind(paella.events.seekToTime,function(event,params) { paella.player.videoContainer.seekToTime(params.time); });
		paella.events.bind(paella.events.setPlaybackRate,function(event,params) { paella.player.videoContainer.setPlaybackRate(params); });
		paella.events.bind(paella.events.setVolume,function(event,params) { paella.player.videoContainer.setVolume(params); });
		paella.events.bind(paella.events.setTrim,function(event,params) { paella.player.videoContainer.setTrimming(params.trimStart, params.trimEnd); });
	},

	onresize:function() {
		this.videoContainer.onresize();
		if (this.controls) this.controls.onresize();
		if (this.editor) {
			this.editor.resize();
		}

		// Resize the layout profile
		var cookieProfile = paella.utils.cookies.get('lastProfile');
		if (cookieProfile) {
			this.setProfile(cookieProfile,false);
		}
		else {
			this.setProfile(this.config.defaultProfile,false);
		}
	},

	unloadAll:function(message) {
		$('#playerContainer')[0].innerHTML = "";
		var loaderContainer = $('#paellaPlayer_loader')[0];
		paella.messageBox.showError(message);
	},

	//setupEditor:function() {
		//if (paella.extended) return;
	//	if (paella.editor && paella.player.config.editor && paella.player.config.editor.enabled && !base.userAgent.browser.IsMobileVersion) {
			//this.controls.showEditorButton();
	//	}
	//	else {
	//		setTimeout('paella.player.setupEditor()',500);
	//	}
	//},

	showEditor:function() {
		new paella.editor.Editor();
	},

	hideEditor:function() {
	},

	loadVideo:function() {
		if (this.videoIdentifier) {
			this.initVideoEvents();
			var This = this;
			var loader = paella.initDelegate.initParams.videoLoader;
			this.onresize();
			loader.loadVideo(this.videoIdentifier,function() {
				var master = loader.streams[0];
				var slave = loader.streams[1];
				if (slave && slave.data && Object.keys(slave.data.sources).length==0) slave = null;
				var frames = loader.frameList;
				var errorMessage;

				if (loader.loadStatus) {
					var preferredMethodMaster = loader.getPreferredMethod(0);
					var preferredMethodSlave  = loader.getPreferredMethod(1);

					//try {
						paella.player.videoContainer.setSources(
							{ data:master, type:preferredMethodMaster },
							{ data:slave, type:preferredMethodSlave }
						);

						paella.events.trigger(paella.events.loadComplete,{masterVideo:master,slaveVideo:slave,frames:frames});
						if (paella.player.isLiveStream()) {
							This.showPlaybackBar();
						}
						This.onresize();
					//}
					//catch(e) {
					//	paella.messageBox.showError(paella.dictionary.translate(e.message));
					//}

				}
				else {
					errorMessage = base.dictionary.translate("Error loading video data");
					paella.messageBox.showError(errorMessage);
					paella.events.trigger(paella.events.error,{error:errorMessage});
				}
			});
		}
	},

	showPlaybackBar:function() {
		if (!this.controls) {
			this.controls = new paella.ControlsContainer(this.playerId + '_controls');
			this.mainContainer.appendChild(this.controls.domElement);
			this.controls.onresize();
			paella.events.trigger(paella.events.loadPlugins,{pluginManager:paella.pluginManager});

		}
	},

	isLiveStream:function() {
		if (this._isLiveStream===undefined) {
			var loader = paella.initDelegate.initParams.videoLoader;
			var checkSource = function(sources,index) {
				if (sources.length>index) {
					var source = sources[index];
					for (var key in source.sources) {
						if (typeof(source.sources[key])=="object") {
							for (var i=0; i<source.sources[key].length; ++i) {
								var stream = source.sources[key][i];
								if (stream.isLiveStream) return true;
							}
						}
					}
				}
				return false;
			};
			this._isLiveStream = checkSource(loader.streams,0) || checkSource(loader.streams,1);
		}
		return this._isLiveStream;
	},

	loadPreviews:function() {
		var streams = paella.initDelegate.initParams.videoLoader.streams;
		var slavePreviewImg = null;

		var masterPreviewImg = streams[0].preview;
		if (streams.length >=2) {
			slavePreviewImg = streams[1].preview;
		}
		if (masterPreviewImg) {
			var masterRect = paella.player.videoContainer.overlayContainer.getMasterRect();
			this.masterPreviewElem = document.createElement('img');
			this.masterPreviewElem.src = masterPreviewImg;
			paella.player.videoContainer.overlayContainer.addElement(this.masterPreviewElem,masterRect);
		}
		if (slavePreviewImg) {
			var slaveRect = paella.player.videoContainer.overlayContainer.getSlaveRect();
			this.slavePreviewElem = document.createElement('img');
			this.slavePreviewElem.src = slavePreviewImg;
			paella.player.videoContainer.overlayContainer.addElement(this.slavePreviewElem,slaveRect);
		}
		paella.events.bind(paella.events.timeUpdate,function(event) {
			paella.player.unloadPreviews();
		});
	},

	unloadPreviews:function() {
		if (this.masterPreviewElem) {
			paella.player.videoContainer.overlayContainer.removeElement(this.masterPreviewElem);
			this.masterPreviewElem = null;
		}
		if (this.slavePreviewElem) {
			paella.player.videoContainer.overlayContainer.removeElement(this.slavePreviewElem);
			this.slavePreviewElem = null;
		}
	},

	loadComplete:function(event,params) {
		var thisClass = this;

		var master = paella.player.videoContainer.masterVideo();
		var getProfile = base.parameters.get('profile');
		var cookieProfile = base.cookies.get('lastProfile');
		if (getProfile) {
			this.setProfile(getProfile);
		}
		else if (cookieProfile) {
			this.setProfile(cookieProfile);
		}
		else {
			this.setProfile(this.config.defaultProfile);
		}

		paella.pluginManager.loadEventDrivenPlugins();
	},

	play:function() {
		this.showPlaybackBar();

		this.videoContainer.play();
		var playerConfig = paella.player.config.player;
		if (playerConfig.stream0Audio===false && paella.player.videoContainer.numberOfStreams()>=1) {
			paella.player.videoContainer.masterVideo().setVolume(0);
		}
		else if (paella.player.videoContainer.numberOfStreams()>=1) {
			paella.player.videoContainer.masterVideo().setVolume(1);
		}
		if (playerConfig.stream1Audio!==true && paella.player.videoContainer.numberOfStreams()>=2) {
			paella.player.videoContainer.slaveVideo().setVolume(1);
		}
		else if (paella.player.videoContainer.numberOfStreams()>=2) {
			paella.player.videoContainer.slaveVideo().setVolume(0);
		}

/*
		var time = paella.utils.parameters.get('time');
		if (time) {
			var duration = master.duration();
			var trimStart = thisClass.videoContainer.trimStart();
			var trimEnd = thisClass.videoContainer.trimEnd();
			if (thisClass.videoContainer.trimEnabled()) {
				duration = trimEnd - trimStart;
			}
			var hour = 0;
			var minute = 0;
			var second = 0;
			if (/([0-9]+)h/.test(time)) {
				hour = Number(RegExp.$1);
			}
			if (/([0-9]+)m/.test(time)) {
				minute = Number(RegExp.$1);
			}
			if (/([0-9]+)s/.test(time)) {
				second = Number(RegExp.$1);
			}
			var currentTime = hour * 60 * 60 + minute * 60 + second;
			var currentPercent = currentTime * 100 / duration;
			paella.events.trigger(paella.events.seekTo,{newPositionPercent:currentPercent});
		}
		thisClass.loadPreviews();
		if (paella.player.config.editor &&
			paella.player.config.editor.enabled &&
			paella.player.config.editor.loadOnStartup) {
			paella.events.trigger(paella.events.showEditor);
		}
		*/
	},

	pause:function() {
		this.videoContainer.pause();
	},

	playing:function() {
		return this.paused();
	},

	paused:function() {
		return this.videoContainer.paused();
	}
});

var PaellaPlayer = paella.PaellaPlayer;

/* Initializer function */
function initPaellaEngage(playerId,initDelegate) {
	if (!initDelegate) {
		initDelegate = new paella.InitDelegate();
	}
	paella.initDelegate = initDelegate;
	var lang = navigator.language || window.navigator.userLanguage;
	paellaPlayer = new PaellaPlayer(playerId,paella.initDelegate);
}
