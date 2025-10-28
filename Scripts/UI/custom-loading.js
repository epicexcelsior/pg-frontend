pc.script.createLoadingScreen((app) => {
     let screen = null;
     let progressFiller = null;
     let loadingTextElement = null;
     let styleTag = null;

     // Function to create and inject the CSS styles for the loading screen
     const createStyles = () => {
          // Ensure styles are only added once
          if (document.getElementById('custom-loading-screen-styles')) return;

          styleTag = document.createElement('style');
          styleTag.id = 'custom-loading-screen-styles';
          styleTag.innerHTML = `
            @keyframes gradientBackgroundLoadingScreen { /* Unique animation name */
                0%, 100% { background-position: 0% 50%; }
                50% { background-position: 100% 50%; }
            }

            #custom-loading-screen {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                z-index: 1001; /* High z-index to be on top */
                background: linear-gradient(-45deg, #9945FF, #14F195, #9945FF, #14F195); /* Gradient matching login screen */
                background-size: 400% 400%;
                animation: gradientBackgroundLoadingScreen 30s ease infinite; /* Use unique animation name */
                padding: 20px;
                box-sizing: border-box;
                opacity: 0; /* Start transparent for fade-in effect */
                transition: opacity 0.3s ease-in-out;
                pointer-events: none; /* Allow interaction with underlying elements when hidden */
            }

            #custom-loading-screen.visible {
                opacity: 1;
                pointer-events: auto; /* Block interaction when visible */
            }

            /* Optional: If you want to add a logo */
            #loading-logo-container {
                 margin-bottom: 30px; /* Space between logo and progress bar */
            }
            #loading-logo-img {
                 max-height: 80px; /* Adjust as needed, similar to your login logo */
                 width: auto;
            }

            #progress-bar-container {
                width: 60%;
                max-width: 350px; /* Max width for the progress bar */
                background-color: rgba(255, 255, 255, 0.6); /* Semi-transparent white, like your login form */
                border: 2px solid rgba(255, 255, 255, 0.7);
                border-radius: 8px; /* Rounded corners like your login inputs/buttons */
                padding: 5px; /* Padding around the filler */
                box-shadow: 0 4px 10px rgba(0, 0, 0, 0.15); /* Subtle shadow */
            }

            #progress-bar-filler {
                height: 20px; /* Height of the progress bar */
                background: linear-gradient(135deg, #43e97b, #38f9d7); /* Gradient from your play button */
                border-radius: 5px; /* Slightly rounded inner bar */
                width: 0%; /* Initial width */
                transition: width 0.2s ease-out; /* Smooth progress update */
            }

            #loading-text-element { /* Unique ID for the text */
                margin-top: 15px;
                font-size: 16px;
                color: #fff; /* White text */
                text-shadow: 0 1px 3px rgba(0, 0, 0, 0.6); /* Text shadow like your login info */
            }

            /* Button container for social/external links */
            #loading-buttons-container {
                position: absolute;
                bottom: 25px;
                left: 50%;
                transform: translateX(-50%);
                display: flex;
                gap: 12px;
                justify-content: center;
                align-items: center;
                flex-wrap: nowrap;
            }

            .social-button {
                position: relative;
                padding: 8px 14px;
                background: rgba(255, 255, 255, 0.85);
                border: 2px solid rgba(255, 255, 255, 0.7);
                border-radius: 12px;
                color: #333;
                text-decoration: none;
                font-size: 18px;
                font-weight: 500;
                transition: all 0.2s ease;
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
                display: inline-flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
                cursor: pointer;
            }

            .social-button:hover {
                background: rgba(255, 255, 255, 1);
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
            }

            .social-button:active {
                box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
            }

            .button-icon {
                display: inline;
                min-width: 20px;
                text-align: center;
            }

            .button-label {
                display: inline;
                margin-left: 8px;
                font-size: 14px;
                white-space: nowrap;
            }

            /* Mobile responsive layout */
            @media (max-width: 768px) {
                #loading-buttons-container {
                    flex-wrap: wrap;
                    gap: 8px;
                    bottom: 20px;
                }

                .social-button {
                    padding: 6px 10px;
                    font-size: 16px;
                }

                #progress-bar-container {
                    width: 80%;
                }
            }

            @media (max-width: 480px) {
                #loading-buttons-container {
                    bottom: 15px;
                    gap: 6px;
                }

                .social-button {
                    padding: 5px 8px;
                    font-size: 14px;
                }

                .button-label {
                    margin-left: 4px;
                    font-size: 12px;
                }
            }
        `;
          document.head.appendChild(styleTag);
     };

     // Function to create and show the loading screen DOM elements
     const show = () => {
          createStyles(); // Ensure CSS is injected

          if (!screen) {
               screen = document.createElement('div');
               screen.id = 'custom-loading-screen';

               // --- Optional: Logo ---
               // If you have a simple logo image (e.g., a small PNG or an SVG)
               // const logoContainer = document.createElement('div');
               // logoContainer.id = 'loading-logo-container';
               // const logoImg = document.createElement('img');
               // logoImg.id = 'loading-logo-img';
               // logoImg.src = 'PATH_TO_YOUR_LOGO.png'; // IMPORTANT: Replace with the actual path to your logo
               //                                     // This asset should ideally be very small or part of the preloaded assets.
               // logoImg.alt = 'Loading Logo';
               // logoContainer.appendChild(logoImg);
               // screen.appendChild(logoContainer);

               // Progress Bar
               const progressBarContainer = document.createElement('div');
               progressBarContainer.id = 'progress-bar-container';
               progressFiller = document.createElement('div');
               progressFiller.id = 'progress-bar-filler';
               progressBarContainer.appendChild(progressFiller);
               screen.appendChild(progressBarContainer);

               // Loading Text
               loadingTextElement = document.createElement('p');
               loadingTextElement.id = 'loading-text-element';
               // loadingTextElement.textContent = 'Loading Game...'; // Initial text, will be updated
               screen.appendChild(loadingTextElement);

               // Social/External Link Buttons
               const buttonsContainer = document.createElement('div');
               buttonsContainer.id = 'loading-buttons-container';

               // Helper function to create social buttons
               const createSocialButton = (icon, label, url) => {
                    const button = document.createElement('a');
                    button.className = 'social-button';
                    button.href = url;
                    button.target = '_blank';
                    button.rel = 'noopener noreferrer';
                    button.title = label;
                    
                    const iconSpan = document.createElement('span');
                    iconSpan.className = 'button-icon';
                    iconSpan.textContent = icon;
                    
                    const labelSpan = document.createElement('span');
                    labelSpan.className = 'button-label';
                    labelSpan.textContent = label;
                    
                    button.appendChild(iconSpan);
                    button.appendChild(labelSpan);
                    return button;
               };

               // Create buttons with emojis
               buttonsContainer.appendChild(createSocialButton('🐦', 'Twitter', 'https://x.com/intent/user?screen_name=playplsgive'));
               buttonsContainer.appendChild(createSocialButton('💬', 'Discord', 'https://dsc.gg/plsgive'));
               buttonsContainer.appendChild(createSocialButton('💭', 'Feedback', 'https://forms.gle/xrJchANvtrouMTWv9'));
               buttonsContainer.appendChild(createSocialButton('🌐', 'Website', 'https://plsgive.com/'));

               screen.appendChild(buttonsContainer);

               document.body.appendChild(screen);
          }

          // Reset progress and make visible by adding the 'visible' class
          if (progressFiller) progressFiller.style.width = '0%';
          if (loadingTextElement) loadingTextElement.textContent = 'Loading... 0%';

          // Use a short timeout to allow the DOM to update before adding the class for the transition
          setTimeout(() => {
               if (screen) screen.classList.add('visible');
          }, 10); // Small delay
     };

     // Function to hide the loading screen
     const hide = () => {
          if (screen) {
               screen.classList.remove('visible');
               // You could remove the screen element from the DOM after the transition
               // setTimeout(() => {
               //     if (screen && screen.parentElement && !screen.classList.contains('visible')) {
               //         screen.parentElement.removeChild(screen);
               //         screen = null; // Allow it to be recreated if needed
               //     }
               // }, 300); // Should match the CSS transition duration
          }
     };

     // Function to update the progress bar and text
     const updateProgress = (value) => {
          if (progressFiller) {
               value = Math.min(1, Math.max(0, value)); // Clamp value between 0 and 1
               progressFiller.style.width = (value * 100) + '%';
          }
          if (loadingTextElement) {
               loadingTextElement.textContent = `Loading... ${Math.round(value * 100)}%`;
          }
     };

     // --- PlayCanvas Application Event Listeners ---

     // Called when asset preloading starts
     app.on('preload:start', () => {
          show();
     });

     // Called during asset preloading with a progress value (0 to 1)
     app.on('preload:progress', (value) => {
          updateProgress(value);
     });

     // Called when asset preloading finishes
     app.on('preload:end', () => {
          updateProgress(1); // Ensure it shows 100%
          // Wait a brief moment for the user to see 100% before hiding
          setTimeout(hide, 250);
     });

     // This event fires when the application is ready to run the first scene.
     // It's a good fallback to ensure the loading screen is hidden.
     app.once('start', () => {
          // Ensure it's hidden if somehow preload:end didn't catch it
          // or for the very initial phase where no major assets were preloaded.
          setTimeout(hide, 500); // A slightly longer delay just in case.
     });

     app.on('load:stream:progress', (payload) => {
          if (!screen || !screen.classList.contains('visible')) {
               return;
          }
          const total = typeof payload.total === 'number' ? payload.total : 0;
          const loaded = typeof payload.loaded === 'number' ? payload.loaded : 0;
          if (total > 0) {
               updateProgress(Math.min(1, loaded / total));
               if (loadingTextElement) {
                    loadingTextElement.textContent = `Streaming assets... ${Math.round((loaded / total) * 100)}%`;
               }
          }
     });

     app.on('transition:begin', (payload) => {
          if (!loadingTextElement) {
               return;
          }
          const message = payload && payload.message ? payload.message : 'Entering...';
          loadingTextElement.textContent = message;
     });

     app.on('transition:end', () => {
          if (!screen) return;
          setTimeout(hide, 120);
     });
});


