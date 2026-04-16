/* ============================================
   NexOS — Calculator App
   ============================================ */

'use strict';

AppRegistry.register({
  id: 'calculator',
  name: 'Calculator',
  icon: '🔢',

  launch() {
    const id = 'calc-win';
    if (WebOS.WindowManager.isOpen(id)) { WebOS.WindowManager.focusWindow(id); return; }

    WebOS.WindowManager.createWindow({
      id, title: 'Calculator', icon: '🔢',
      width: 340, height: 520,
      minWidth: 280, minHeight: 420,
      content: `
        <div class="calc-container">
          <div class="calc-display">
            <div class="calc-expression" id="calc-expr"></div>
            <div class="calc-result"     id="calc-result">0</div>
          </div>
          <div class="calc-grid" id="calc-grid">
            <!-- Row 1 -->
            <button class="calc-btn fn" data-val="clear" id="calc-clear">AC</button>
            <button class="calc-btn fn" data-val="sign">+/−</button>
            <button class="calc-btn fn" data-val="pct">%</button>
            <button class="calc-btn op" data-val="÷">÷</button>
            <!-- Row 2 -->
            <button class="calc-btn num" data-val="7">7</button>
            <button class="calc-btn num" data-val="8">8</button>
            <button class="calc-btn num" data-val="9">9</button>
            <button class="calc-btn op"  data-val="×">×</button>
            <!-- Row 3 -->
            <button class="calc-btn num" data-val="4">4</button>
            <button class="calc-btn num" data-val="5">5</button>
            <button class="calc-btn num" data-val="6">6</button>
            <button class="calc-btn op"  data-val="−">−</button>
            <!-- Row 4 -->
            <button class="calc-btn num" data-val="1">1</button>
            <button class="calc-btn num" data-val="2">2</button>
            <button class="calc-btn num" data-val="3">3</button>
            <button class="calc-btn op"  data-val="+">+</button>
            <!-- Row 5 -->
            <button class="calc-btn num" data-val="0" style="grid-column:span 2">0</button>
            <button class="calc-btn num" data-val=".">.</button>
            <button class="calc-btn eq"  data-val="=">=</button>
          </div>
        </div>
      `,
      onReady: (body) => _initCalc(body),
    });
  }
});

function _initCalc(body) {
  const exprEl   = body.querySelector('#calc-expr');
  const resultEl = body.querySelector('#calc-result');

  let current  = '0';
  let expr     = '';
  let operator = null;
  let operand  = null;
  let justCalc = false;

  body.querySelectorAll('.calc-btn').forEach(btn => {
    btn.addEventListener('click', () => handle(btn.dataset.val));
  });

  // Keyboard support
  body.getRootNode().addEventListener('keydown', (e) => {
    const map = {
      '0':'0','1':'1','2':'2','3':'3','4':'4','5':'5','6':'6','7':'7','8':'8','9':'9',
      '.':'.','+':`+`,'-':'−','*':'×','/':'÷','Enter':'=','Backspace':'back','Escape':'clear','%':'pct'
    };
    const val = map[e.key];
    if (val) { e.preventDefault(); handle(val); }
  });

  function handle(val) {
    switch(val) {
      case 'clear':
        current = '0'; expr = ''; operator = null; operand = null; justCalc = false;
        break;

      case 'back':
        if (current.length > 1) current = current.slice(0,-1);
        else current = '0';
        break;

      case 'sign':
        current = String(-parseFloat(current));
        break;

      case 'pct':
        current = String(parseFloat(current) / 100);
        break;

      case '+': case '−': case '×': case '÷':
        if (operator && !justCalc) {
          const res = calculate(parseFloat(operand), parseFloat(current), operator);
          current = String(res);
        }
        operand  = current;
        operator = val;
        expr     = `${current} ${val}`;
        justCalc = false;
        current  = '0';
        break;

      case '=':
        if (!operator) break;
        const a   = parseFloat(operand);
        const b   = parseFloat(current);
        const res = calculate(a, b, operator);
        expr      = `${operand} ${operator} ${current} =`;
        current   = formatResult(res);
        operator  = null;
        operand   = null;
        justCalc  = true;
        break;

      case '.':
        if (justCalc) { current = '0.'; justCalc = false; break; }
        if (!current.includes('.')) current += '.';
        break;

      default: // number
        if (justCalc) { current = val; justCalc = false; break; }
        current = current === '0' ? val : current + val;
        if (current.length > 12) current = current.slice(0,-1);
    }

    exprEl.textContent   = expr;
    resultEl.textContent = formatResult(parseFloat(current)) || current;

    // Animation
    resultEl.style.transform = 'scale(1.02)';
    setTimeout(() => resultEl.style.transform = '', 80);
  }

  function calculate(a, b, op) {
    switch(op) {
      case '+': return a + b;
      case '−': return a - b;
      case '×': return a * b;
      case '÷': return b === 0 ? NaN : a / b;
      default:  return b;
    }
  }

  function formatResult(n) {
    if (isNaN(n)) return 'Error';
    if (!isFinite(n)) return 'Infinity';
    if (String(n).includes('e')) return n.toExponential(4);
    const s = String(n);
    if (s.length > 12) return parseFloat(n.toFixed(8)).toString();
    return s;
  }
}
