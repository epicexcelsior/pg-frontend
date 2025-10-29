///<reference path="c:\Users\Epic\.vscode-insiders\extensions\playcanvas.playcanvas-0.2.1\node_modules\playcanvas\build\playcanvas.d.ts"
var HtmlEmbed = pc.createScript('htmlEmbed');

// initialize code called once per entity
HtmlEmbed.prototype.initialize = function () {
    // Add social buttons to bottom right corner
    var styles = `
        #game-social-buttons {
            position: fixed;
            bottom: 20px;
            right: 20px;
            display: flex;
            flex-direction: row;
            gap: 8px;
            z-index: 100;
        }
        
        .game-social-btn {
            width: 40px;
            height: 40px;
            background: rgba(255, 255, 255, 0.9);
            border: 2px solid rgba(255, 255, 255, 0.7);
            border-radius: 10px;
            color: #333;
            text-decoration: none;
            font-size: 18px;
            font-weight: 500;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: all 0.2s ease;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
            position: relative;
            overflow: visible;
        }
        
        .game-social-btn:hover {
            background: rgba(255, 255, 255, 1);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
        }
        
        .game-social-btn:active {
            box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
        }
        
        .btn-icon {
            display: inline;
            min-width: 18px;
            text-align: center;
        }
        
        .btn-tooltip {
            position: absolute;
            bottom: 50px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0, 0, 0, 0.9);
            color: #fff;
            padding: 6px 10px;
            border-radius: 6px;
            font-size: 12px;
            white-space: nowrap;
            pointer-events: none;
            opacity: 0;
            transition: opacity 0.2s ease;
            z-index: 101;
        }
        
        .btn-tooltip::after {
            content: '';
            position: absolute;
            top: 100%;
            left: 50%;
            transform: translateX(-50%);
            border: 4px solid transparent;
            border-top-color: rgba(0, 0, 0, 0.9);
        }
        
        .game-social-btn:hover .btn-tooltip {
            opacity: 1;
        }
        
        @media (max-width: 480px) {
            #game-social-buttons {
                bottom: 15px;
                right: 15px;
                gap: 6px;
            }
            
            .game-social-btn {
                width: 36px;
                height: 36px;
                font-size: 16px;
            }
            
            .btn-tooltip {
                font-size: 11px;
                padding: 5px 8px;
                bottom: 45px;
            }
        }
    `;
    
    var html = `
        <style>${styles}</style>
        <div id="game-social-buttons">
            <a href="https://x.com/intent/user?screen_name=playplsgive" target="_blank" rel="noopener noreferrer" class="game-social-btn">
                <span class="btn-icon">🐦</span>
                <span class="btn-tooltip">Twitter</span>
            </a>
            <a href="https://dsc.gg/plsgive" target="_blank" rel="noopener noreferrer" class="game-social-btn">
                <span class="btn-icon">💬</span>
                <span class="btn-tooltip">Discord</span>
            </a>
            <a href="https://forms.gle/xrJchANvtrouMTWv9" target="_blank" rel="noopener noreferrer" class="game-social-btn">
                <span class="btn-icon">💭</span>
                <span class="btn-tooltip">Feedback</span>
            </a>
            <a href="https://plsgive.com/" target="_blank" rel="noopener noreferrer" class="game-social-btn">
                <span class="btn-icon">🌐</span>
                <span class="btn-tooltip">Website</span>
            </a>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', html);
};