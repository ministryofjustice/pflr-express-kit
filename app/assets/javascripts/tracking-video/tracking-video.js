'use strict';

// https://developers.google.com/youtube/iframe_api_reference
jQuery(function () {
  var videos = jQuery('[type=video] iframe');
  if (videos.length) {
    var iframeAPI = document.createElement('script');
    iframeAPI.src = 'https://www.youtube.com/iframe_api';
    var firstScriptElement = document.getElementsByTagName('script')[0];
    firstScriptElement.parentNode.insertBefore(iframeAPI, firstScriptElement);

    var eventState = {
      '0': 'end',
      '1': 'play'
    };
    var onPlayerStateChange = function onPlayerStateChange(event) {
      var eventName = eventState[event.data];
      var videoId = this.id;
      if (eventName) {
        if (eventName === 'play') {
          if (!this.hasBeenStarted) {
            eventName = 'start';
          }
          this.hasBeenStarted = true;
        }

        ga('send', 'event', {
          eventCategory: 'video',
          eventAction: videoId,
          eventLabel: eventName
        });
      }
    };
    window.onYouTubeIframeAPIReady = function () {
      window.ytplayers = {};
      videos.each(function (index, video) {
        window.ytplayers[video.id] = new YT.Player(video.id, {
          events: {
            onStateChange: onPlayerStateChange.bind(video)
          }
        });
      });
    };
  }
});