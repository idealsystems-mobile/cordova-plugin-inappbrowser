/*
 *
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 *
*/

/*jslint sloppy:true */
/*global Windows:true, require, document, setTimeout, window, module */



var cordova = require('cordova'),
    channel = require('cordova/channel'),
    urlutil = require('cordova/urlutil');

var browserWrap,
    popup,
    navigationButtonsDiv,
    navigationButtonsDivInner,
    backButton,
    forwardButton,
    closeButton;

// x-ms-webview is available starting from Windows 8.1 (platformId is 'windows')
// http://msdn.microsoft.com/en-us/library/windows/apps/dn301831.aspx
var isWebViewAvailable = cordova.platformId == 'windows';

function attachNavigationEvents(element, callback) {
    if (isWebViewAvailable) {
         element.addEventListener("MSWebViewNavigationStarting", function (e) {
            mcf.spinner.start();
            callback({ type: "loadstart", url: e.uri}, {keepCallback: true} );
        });

        element.addEventListener("MSWebViewNavigationCompleted", function (e) {
            //mcf.spinner.stop();
            callback({ type: e.isSuccess ? "loadstop" : "loaderror", url: e.uri}, {keepCallback: true});
        });

        element.addEventListener("MSWebViewUnviewableContentIdentified", function (e) {
            //mcf.spinner.stop();
            // WebView found the content to be not HTML.
            // http://msdn.microsoft.com/en-us/library/windows/apps/dn609716.aspx
            callback({ type: "loaderror", url: e.uri}, {keepCallback: true});
        });

        element.addEventListener("MSWebViewContentLoading", function (e) {
            if (navigationButtonsDiv && popup) {
                //backButton.disabled = !popup.canGoBack;
                //forwardButton.disabled = !popup.canGoForward;
            }
        });
    } else {
        var onError = function () {
            callback({ type: "loaderror", url: this.contentWindow.location}, {keepCallback: true});
        };

        element.addEventListener("unload", function () {
            callback({ type: "loadstart", url: this.contentWindow.location}, {keepCallback: true});
        });

        element.addEventListener("load", function () {
            callback({ type: "loadstop", url: this.contentWindow.location}, {keepCallback: true});
        });

        element.addEventListener("error", onError);
        element.addEventListener("abort", onError);
    }
}

function setButtonStyle(element) {
    element.style.width = "60px";
    element.style.borderRadius = "20px";
    element.style.backgroundColor = "lightgrey";
    element.style.textAlign = "center";
    element.style.fontSize = "30px";
    element.style.display = "inline-block";
    element.style.margin = "0 4px";
}

var IAB = {
    close: function (win, lose) {
        if (browserWrap) {
            if (win) win({ type: "exit" });
            
            browserWrap.parentNode.removeChild(browserWrap);
            browserWrap = null;
            popup = null;
            for (var i = 0; i < document.body.childElementCount; i++) {
                document.body.children[i].style.display = document.body.children[i].getAttribute("data-visible");
                document.body.children[i].removeAttribute("data-visible");
            }
        }
    },
    show: function (win, lose) {
        if (browserWrap) {
            
            for (var i = 0; i < document.body.childElementCount; i++) {
                document.body.children[i].setAttribute("data-visible", document.body.children[i].style.display);
                document.body.children[i].style.display = "none";
            }
            browserWrap.style.display = "block";
        }
    },
    open: function (win, lose, args) {
        var strUrl = args[0],
            target = args[1],
            features = args[2],
            url;

        if (target === "_system") {
            url = new Windows.Foundation.Uri(strUrl);
            Windows.System.Launcher.launchUriAsync(url);
        } else if (target === "_self" || !target) {
            window.location = strUrl;
        } else {
            // "_blank" or anything else
            if (!browserWrap) {
                browserWrap = document.createElement("div");
                browserWrap.style.position = "absolute";
                browserWrap.style.width = "100%";
                browserWrap.style.height = "100%";

                browserWrap.onclick = function () {
                    setTimeout(function () {
                        IAB.close(win);
                    }, 0);
                };

                document.body.appendChild(browserWrap);
            }

            if (features.indexOf("hidden=yes") !== -1) {
                browserWrap.style.display = "none";
            }

            popup = document.createElement(isWebViewAvailable ? "x-ms-webview" : "iframe");
            popup.style.borderWidth = "0px";
            popup.style.width = "100%";

            browserWrap.appendChild(popup);

            if (features.indexOf("location=yes") !== -1 || features.indexOf("location") === -1) {
                popup.style.height = "calc(100% - 65px)";

                navigationButtonsDiv = document.createElement("div");
                navigationButtonsDiv.style.height = "65px";
                navigationButtonsDiv.style.backgroundColor = "#BDBDBD";
                navigationButtonsDiv.style.zIndex = "999";
                navigationButtonsDiv.onclick = function (e) {
                    e.cancelBubble = true;
                };

                navigationButtonsDivInner = document.createElement("div");
                navigationButtonsDivInner.style.paddingTop = "10px";
                navigationButtonsDivInner.style.height = "50px";
                navigationButtonsDivInner.style.width = "210px";
                navigationButtonsDivInner.style.margin = "0 auto";
                navigationButtonsDivInner.style.backgroundColor = "#BDBDBD";
                navigationButtonsDivInner.style.zIndex = "999";
                navigationButtonsDivInner.onclick = function (e) {
                    e.cancelBubble = true;
                };


                backButton = document.createElement("div");
                setButtonStyle(backButton);
                backButton.innerText = "<";
                backButton.addEventListener("click", function (e) {
                    if (popup.canGoBack) popup.goBack();
                });

                forwardButton = document.createElement("div");
                setButtonStyle(forwardButton);
                forwardButton.innerText = ">";
                forwardButton.addEventListener("click", function (e) {
                    if (popup.canGoForward) popup.goForward();
                });

                closeButton = document.createElement("div");
                setButtonStyle(closeButton);
                closeButton.innerText = "X";
                closeButton.addEventListener("click", function (e) {
                    setTimeout(function () {
                        IAB.close(win);
                    }, 0);
                });
               
                if (!isWebViewAvailable) {
                    // iframe navigation is not yet supported
                    //backButton.disabled = true;
                    //forwardButton.disabled = true;
                }

                navigationButtonsDivInner.appendChild(backButton);
                navigationButtonsDivInner.appendChild(forwardButton);
                navigationButtonsDivInner.appendChild(closeButton);
                navigationButtonsDiv.appendChild(navigationButtonsDivInner);

                browserWrap.style.backgroundColor = "#BDBDBD";
                browserWrap.appendChild(navigationButtonsDiv);
            } else {
                popup.style.height = "100%";
            }

            // start listening for navigation events
            attachNavigationEvents(popup, win);

            if (isWebViewAvailable) {
                strUrl = strUrl.replace("ms-appx://", "ms-appx-web://");
            }
            popup.src = strUrl;
        }
		IAB.show();
    },

    injectScriptCode: function (win, fail, args) {
        var code = args[0],
            hasCallback = args[1];

        if (isWebViewAvailable && browserWrap && popup) {
            var op = popup.invokeScriptAsync("eval", code);
            op.oncomplete = function () { hasCallback && win([]); };
            op.onerror = function () { };
            op.start();
        }
    },

    injectScriptFile: function (win, fail, args) {
        var filePath = args[0],
            hasCallback = args[1];

        if (!!filePath) {
            filePath = urlutil.makeAbsolute(filePath);
        }

        if (isWebViewAvailable && browserWrap && popup) {
            var uri = new Windows.Foundation.Uri(filePath);
            Windows.Storage.StorageFile.getFileFromApplicationUriAsync(uri).done(function (file) {
                Windows.Storage.FileIO.readTextAsync(file).done(function (code) {
                    var op = popup.invokeScriptAsync("eval", code);
                    op.oncomplete = function () { hasCallback && win([]); };
                    op.onerror = function () { };
                    op.start();
                });
            });
        }
    }
};

module.exports = IAB;

require("cordova/exec/proxy").add("InAppBrowser", module.exports);
