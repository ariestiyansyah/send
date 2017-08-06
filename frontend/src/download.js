const { Raven, findMetric, sendEvent } = require('./common');
const FileReceiver = require('./fileReceiver');
const { notify, gcmCompliant } = require('./utils');
const bytes = require('bytes');
const Storage = require('./storage');
const storage = new Storage(localStorage);
const links = require('./links');

const $ = require('jquery');
require('jquery-circle-progress');

$(() => {
  gcmCompliant()
    .then(() => {
      const $downloadBtn = $('#download-btn');
      const $sendNew = $('.send-new');
      const $dlProgress = $('#dl-progress');
      const $progressText = $('.progress-text');
      const $title = $('.title');

      $sendNew.on('click', () => {
        sendEvent('recipient', 'restarted', {
          cd2: 'completed'
        });
      });

      $('.legal-links a, .social-links a, #dl-firefox').on('click', function(target) {
        const metric = findMetric(target.currentTarget.href);
        // record exited event by recipient
        sendEvent('recipient', 'exited', {
          cd3: metric
        });
      });

      const filename = $('#dl-filename').text();
      const bytelength = Number($('#dl-bytelength').text());
      const timeToExpiry = Number($('#dl-ttl').text());

      //initiate progress bar
      $dlProgress.circleProgress({
        value: 0.0,
        startAngle: -Math.PI / 2,
        fill: '#3B9DFF',
        size: 158,
        animation: { duration: 300 }
      });

      const download = () => {
        // Disable the download button to avoid accidental double clicks.
        $downloadBtn.attr('disabled', 'disabled');
        links.setOpenInNewTab(true);

        storage.totalDownloads += 1;

        const fileReceiver = new FileReceiver();
        const unexpiredFiles = storage.numFiles;

        fileReceiver.on('progress', progress => {
          window.onunload = function() {
            storage.referrer = 'cancelled-download';
            // record download-stopped (cancelled by tab close or reload)
            sendEvent('recipient', 'download-stopped', {
              cm1: bytelength,
              cm5: storage.totalUploads,
              cm6: unexpiredFiles,
              cm7: storage.totalDownloads,
              cd2: 'cancelled'
            });
          };

          $('#download-page-one').attr('hidden', true);
          $('#download-progress').removeAttr('hidden');
          const percent = progress[0] / progress[1];
          // update progress bar
          $dlProgress.circleProgress('value', percent);
          $('.percent-number').text(`${Math.floor(percent * 100)}`);
          $progressText.text(
            `${filename} (${bytes(progress[0], {
              decimalPlaces: 1,
              fixedDecimals: true
            })} of ${bytes(progress[1], { decimalPlaces: 1 })})`
          );
        });

        let downloadEnd;
        fileReceiver.on('decrypting', isStillDecrypting => {
          // The file is being decrypted
          if (isStillDecrypting) {
            fileReceiver.removeAllListeners('progress');
            window.onunload = null;
            document.l10n.formatValue('decryptingFile').then(decryptingFile => {
              $progressText.text(decryptingFile);
            });
          } else {
            downloadEnd = Date.now();
          }
        });

        fileReceiver.on('hashing', isStillHashing => {
          // The file is being hashed to make sure a malicious user hasn't tampered with it
          if (isStillHashing) {
            document.l10n.formatValue('verifyingFile').then(verifyingFile => {
              $progressText.text(verifyingFile);
            });
          } else {
            $progressText.text(' ');
            document.l10n
              .formatValues('downloadNotification', 'downloadFinish')
              .then(translated => {
                notify(translated[0]);
                $title.text(translated[1]);
              });
          }
        });

        const startTime = Date.now();

        // record download-started by recipient
        sendEvent('recipient', 'download-started', {
          cm1: bytelength,
          cm4: timeToExpiry,
          cm5: storage.totalUploads,
          cm6: unexpiredFiles,
          cm7: storage.totalDownloads
        });

        fileReceiver
          .download()
          .catch(err => {
            // record download-stopped (errored) by recipient
            sendEvent('recipient', 'download-stopped', {
              cm1: bytelength,
              cm5: storage.totalUploads,
              cm6: unexpiredFiles,
              cm7: storage.totalDownloads,
              cd2: 'errored',
              cd6: err
            });

            if (err.message === 'notfound') {
              location.reload();
            } else {
              document.l10n.formatValue('errorPageHeader').then(translated => {
                $title.text(translated);
              });
              $downloadBtn.attr('hidden', true);
              $('#expired-img').removeAttr('hidden');
            }
            throw err;
          })
          .then(([decrypted, fname]) => {
            const endTime = Date.now();
            const totalTime = endTime - startTime;
            const downloadTime = endTime - downloadEnd;
            const downloadSpeed = bytelength / (downloadTime / 1000);

            storage.referrer = 'completed-download';
            // record download-stopped (completed) by recipient
            sendEvent('recipient', 'download-stopped', {
              cm1: bytelength,
              cm2: totalTime,
              cm3: downloadSpeed,
              cm5: storage.totalUploads,
              cm6: unexpiredFiles,
              cm7: storage.totalDownloads,
              cd2: 'completed'
            });

            const dataView = new DataView(decrypted);
            const blob = new Blob([dataView]);
            const downloadUrl = URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.href = downloadUrl;
            if (window.navigator.msSaveBlob) {
              // if we are in microsoft edge or IE
              window.navigator.msSaveBlob(blob, fname);
              return;
            }
            a.download = fname;
            document.body.appendChild(a);
            a.click();
          })
          .catch(err => {
            Raven.captureException(err);
            return Promise.reject(err);
          })
          .then(() => links.setOpenInNewTab(false));
      }

      $downloadBtn.on('click', download);
    })
    .catch(err => {
      sendEvent('sender', 'unsupported', {
        cd6: err
      }).then(() => {
        location.replace('/unsupported/gcm');
      });
    });
});
