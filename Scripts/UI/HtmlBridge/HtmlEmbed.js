///<reference path="c:\Users\Epic\.vscode-insiders\extensions\playcanvas.playcanvas-0.2.1\node_modules\playcanvas\build\playcanvas.d.ts"
var HtmlEmbed = pc.createScript('htmlEmbed');

// initialize code called once per entity
HtmlEmbed.prototype.initialize = function () {
     var html = '<a target="_blank" href="https://forms.gle/Y2aWx8S3Q4cY1ANT9" style="font-family: \'system-ui\', sans-serif; position: fixed; bottom: -1px; right: -1px; padding: 8px; font-size: 17px; font-weight: bold; background: #fff; color: #000; text-decoration: none; z-index: 10000; border-top-left-radius: 12px; border: 1px solid #fff;">💭 Give Feedback</a>';
     document.body.insertAdjacentHTML('beforeend', html);
};