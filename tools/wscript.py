"""A small WitcherScript (.ws) interpreter, enough to run the game's own UI text functions offline.

It runs real script functions (indexed from content/content0/scripts) instead of copying their logic,
so a game update needs no tool changes. What it supports:
  statements   var declarations, expressions, if / else, switch (with fall-through), return, break, blocks
  expressions  literals ('names', "strings", ints, floats with f), + - * / % ! && || comparisons,
               = += -= *= /=, calls, member access, casts like (int)x
  values       int and float (ints divide as ints), strings, names (strings), enum members (Enum),
               SAbilityAttributeValue (AttributeValue), plain objects (dict-backed Obj)
Script functions and methods are looked up by name across all scripts (same-file first). Engine
functions (import function ...) come from `natives`; anything else missing raises ScriptError, so an
unsupported path fails loudly instead of producing a wrong number.
"""
import math
import os
import re


class ScriptError(Exception):
    pass


class Enum:
    """An enum member. Compares by ordinal, so `skill <= S_Sword_s36` works like in game."""

    def __init__(self, name, value):
        self.name, self.value = name, value

    def __eq__(self, other):
        return isinstance(other, Enum) and self.name == other.name

    def __hash__(self):
        return hash(self.name)

    def __repr__(self):
        return self.name


class AttributeValue:
    """SAbilityAttributeValue. `src` lists the XML attributes the value came from."""

    def __init__(self, base=0.0, add=0.0, mult=0.0, src=()):
        self.valueBase, self.valueAdditive, self.valueMultiplicative = base, add, mult
        self.src = tuple(src)

    def _map(self, f, other_src=()):
        return AttributeValue(f(self.valueBase), f(self.valueAdditive), f(self.valueMultiplicative),
                              self.src + tuple(s for s in other_src if s not in self.src))

    def copy(self):
        return self._map(lambda v: v)


class Obj(dict):
    """A script object or struct: fields as keys, methods resolved by the interpreter."""

    def __init__(self, cls, **fields):
        super().__init__(fields)
        self.cls = cls


class Num(float):
    """A float that remembers which XML attributes it came from (for naming placeholders)."""

    def __new__(cls, value, src=()):
        n = super().__new__(cls, value)
        n.src = tuple(src)
        return n


class Int(int):
    """An int that remembers which XML attributes it came from."""

    def __new__(cls, value, src=()):
        n = super().__new__(cls, value)
        n.src = tuple(src)
        return n


def src_of(v):
    return getattr(v, 'src', ())


def tag(value, src):
    """Attach `src` to a number result (ints stay ints, so int division and printing match the game)."""
    if not src or isinstance(value, bool):
        return value
    return Int(value, src) if isinstance(value, int) else Num(value, src)


# ---------------------------------------------------------------- lexer

TOKEN = re.compile(r'''
    (?P<ws>\s+|//[^\n]*|/\*.*?\*/)
  | (?P<num>\d+\.\d*f?|\.\d+f?|\d+f?)
  | (?P<str>"(?:\\.|[^"\\])*")
  | (?P<name>'[^']*')
  | (?P<id>[A-Za-z_]\w*)
  | (?P<op>==|!=|<=|>=|&&|\|\||\+=|-=|\*=|/=|[-+*/%!<>=(){}\[\],;.:?&|])
''', re.S | re.X)


def tokenize(src, start=0, end=None):
    end = len(src) if end is None else end
    out, pos = [], start
    while pos < end:
        m = TOKEN.match(src, pos)
        if not m:
            raise ScriptError('cannot read script at %r' % src[pos:pos + 30])
        pos = m.end()
        kind = m.lastgroup
        if kind != 'ws':
            out.append((kind, m.group()))
    return out


# ---------------------------------------------------------------- parser (tokens -> tuples)

BINARY = {'||': 1, '&&': 2, '==': 3, '!=': 3, '<': 4, '>': 4, '<=': 4, '>=': 4,
          '+': 5, '-': 5, '*': 6, '/': 6, '%': 6}
ASSIGN = {'=', '+=', '-=', '*=', '/='}
TYPE_WORDS = {'int', 'float', 'bool', 'string', 'name'}


class Parser:
    def __init__(self, tokens):
        self.t, self.i = tokens, 0

    def peek(self, k=0):
        return self.t[self.i + k] if self.i + k < len(self.t) else (None, None)

    def take(self, value=None):
        tok = self.peek()
        if value is not None and tok[1] != value:
            raise ScriptError('expected %r, got %r' % (value, tok[1]))
        self.i += 1
        return tok

    def accept(self, value):
        if self.peek()[1] == value:
            self.i += 1
            return True
        return False

    def block(self):
        self.take('{')
        body = []
        while not self.accept('}'):
            body.append(self.statement())
        return ('block', body)

    def statement(self):
        kind, v = self.peek()
        if v == '{':
            return self.block()
        if v == ';':
            self.take()
            return ('block', [])
        if v == 'var':
            self.take()
            names = [self.take()[1]]
            while self.accept(','):
                names.append(self.take()[1])
            self.take(':')
            vtype = self.type_name()
            self.take(';')
            return ('var', names, vtype)
        if v == 'if':
            self.take()
            self.take('(')
            cond = self.expr()
            self.take(')')
            then = self.statement()
            other = self.statement() if self.accept('else') else None
            return ('if', cond, then, other)
        if v == 'switch':
            self.take()
            self.take('(')
            subject = self.expr()
            self.take(')')
            self.take('{')
            cases, body = [], []
            while not self.accept('}'):
                if self.accept('case'):
                    label = self.expr()
                    self.take(':')
                    cases.append((label, len(body)))
                elif self.accept('default'):
                    self.take(':')
                    cases.append((None, len(body)))
                else:
                    body.append(self.statement())
            return ('switch', subject, cases, body)
        if v == 'return':
            self.take()
            value = None if self.peek()[1] == ';' else self.expr()
            self.take(';')
            return ('return', value)
        if v == 'break':
            self.take()
            self.take(';')
            return ('break',)
        if v in ('for', 'while', 'do'):
            raise ScriptError('loops are not supported (%s)' % v)
        e = self.expr()
        self.take(';')
        return ('expr', e)

    def type_name(self):
        name = self.take()[1]
        if self.accept('<'):
            inner = self.type_name()
            self.take('>')
            return 'array<%s>' % inner if name == 'array' else name
        return name

    def expr(self):
        left = self.binary(0)
        if self.peek()[1] in ASSIGN:
            op = self.take()[1]
            return ('assign', op, left, self.expr())
        return left

    def binary(self, min_prec):
        left = self.unary()
        while True:
            op = self.peek()[1]
            prec = BINARY.get(op)
            if self.peek()[0] != 'op' or prec is None or prec <= min_prec:
                return left
            self.take()
            left = ('bin', op, left, self.binary(prec))

    def unary(self):
        v = self.peek()[1]
        if v in ('-', '!', '+'):
            self.take()
            return ('unary', v, self.unary())
        # cast: (int)x, (float)x, (CSomeClass)x
        if v == '(' and self.peek(1)[0] == 'id' and self.peek(2)[1] == ')' and (
                self.peek(1)[1] in TYPE_WORDS
                or self.peek(1)[1][:1] in 'CW' and (self.peek(3)[0] in ('id', 'num') or self.peek(3)[1] == '(')):
            self.take()
            to = self.take()[1]
            self.take(')')
            return ('cast', to, self.unary())
        return self.postfix(self.primary())

    def primary(self):
        kind, v = self.take()
        if kind == 'num':
            text = v.rstrip('f')
            return ('lit', float(text) if '.' in text or v.endswith('f') else int(text))
        if kind == 'str':
            return ('lit', bytes(v[1:-1], 'utf-8').decode('unicode_escape'))
        if kind == 'name':
            return ('lit', v[1:-1])
        if kind == 'id':
            if v in ('true', 'false'):
                return ('lit', v == 'true')
            if v == 'NULL':
                return ('lit', None)
            return ('id', v)
        if v == '(':
            e = self.expr()
            self.take(')')
            return e
        raise ScriptError('unexpected %r' % v)

    def postfix(self, e):
        while True:
            v = self.peek()[1]
            if v == '(':
                self.take()
                args = []
                while not self.accept(')'):
                    # an empty argument (f(a, , b)) passes the default value
                    args.append(None if self.peek()[1] in (',', ')') else self.expr())
                    self.accept(',')
                e = ('call', e, args)
            elif v == '.':
                self.take()
                e = ('member', e, self.take()[1])
            elif v == '[':
                self.take()
                idx = self.expr()
                self.take(']')
                e = ('index', e, idx)
            else:
                return e


# ---------------------------------------------------------------- script index

FUNC_HEAD = re.compile(r'\b(?:(import)\s+)?(?:(?:private|protected|public|final|latent|timer|entry|'
                       r'storyscene|quest|cleanup|reward|exec)\s+)*(?:function|event)\s+(\w+)\s*\(')
ENUM_DEF = re.compile(r'\benum\s+(\w+)\s*\{([^}]*)\}', re.S)
DEFAULT_DEF = re.compile(r'\bdefault\s+(\w+)\s*=\s*([^;]+);')


class Function:
    def __init__(self, name, path, src, start):
        self.name, self.path, self._src, self._start = name, path, src, start
        self._parsed = None

    def parsed(self):
        """(param names, out-param names, body)."""
        if self._parsed is None:
            src, i = self._src, self._src.index('(', self._start)
            depth, j = 0, i
            while True:
                depth += {'(': 1, ')': -1}.get(src[j], 0)
                if depth == 0:
                    break
                j += 1
            # "optional out a, b : T, c : array<U>": names before ':' share the type and modifiers.
            params, outs, is_out = [], set(), False
            p = Parser(tokenize(src, i + 1, j))
            while p.peek()[0] is not None:
                v = p.take()[1]
                if v in ('optional', 'inout'):
                    continue
                if v == 'out':
                    is_out = True
                elif v == ':':
                    p.type_name()
                    is_out = False
                elif v != ',':
                    params.append(v)
                    if is_out:
                        outs.add(v)
            body_start = src.index('{', j)
            p = Parser(tokenize(src, body_start, self._block_end(body_start)))
            self._parsed = (params, outs, p.block())
        return self._parsed

    @staticmethod
    def _skip(src, k):
        """Skip a comment or string starting at k; return the new index or None."""
        if src.startswith('//', k):
            return src.find('\n', k)
        if src.startswith('/*', k):
            return src.find('*/', k) + 2
        if src[k] in '"\'':
            q, k = src[k], k + 1
            while src[k] != q:
                k += 2 if src[k] == '\\' else 1
            return k + 1
        return None

    def _block_end(self, k):
        src, depth = self._src, 0
        while True:
            skipped = self._skip(src, k)
            if skipped is not None:
                k = skipped
                continue
            depth += {'{': 1, '}': -1}.get(src[k], 0)
            k += 1
            if depth == 0:
                return k


class ScriptIndex:
    """Every function, enum and class default in content/content0/scripts."""

    def __init__(self, scripts_dir):
        self.functions, self.enums, self.defaults = {}, {}, {}
        for root, _, files in os.walk(scripts_dir):
            for f in files:
                if f.endswith('.ws'):
                    path = os.path.join(root, f)
                    with open(path, encoding='utf-8', errors='replace') as fh:
                        self._index(path, fh.read())

    def _index(self, path, src):
        for m in FUNC_HEAD.finditer(src):
            if not m.group(1):
                self.functions.setdefault(m.group(2), []).append(Function(m.group(2), path, src, m.start()))
        for m in ENUM_DEF.finditer(src):
            value = 0
            for item in re.sub(r'//[^\n]*|/\*.*?\*/', '', m.group(2), flags=re.S).split(','):
                item = item.strip()
                if not item:
                    continue
                name, _, given = item.partition('=')
                if given.strip():
                    value = int(given.strip(), 0)
                self.enums[name.strip()] = Enum(name.strip(), value)
                value += 1
        for m in DEFAULT_DEF.finditer(src):
            self.defaults.setdefault(m.group(1), m.group(2).strip())

    def function(self, name, prefer_path=None):
        found = self.functions.get(name, [])
        for f in found:
            if f.path == prefer_path:
                return f
        return found[0] if found else None


# ---------------------------------------------------------------- interpreter

class _Return(Exception):
    def __init__(self, value):
        self.value = value


class _Break(Exception):
    pass


def default_for(vtype):
    if vtype.startswith('array<'):
        return []
    if vtype == 'SAbilityAttributeValue':
        return AttributeValue()
    if vtype in ('int',):
        return 0
    if vtype == 'float':
        return 0.0
    if vtype in ('string', 'name'):
        return ''
    if vtype == 'bool':
        return False
    return None


def round_math(f):
    """RoundMath from core/math.ws: halves round away from zero."""
    return int(math.floor(f + 0.5)) if f >= 0 else -int(math.floor(-f + 0.5))


class Interpreter:
    """Runs script functions. `natives` maps a function name to a Python callable; for a method,
    `methods` maps (class, name). Globals such as theGame are given in `globals_`."""

    def __init__(self, index, natives=None, methods=None, globals_=None, engine_enums=None):
        """engine_enums: regex for enum members declared in the engine, not in scripts (such as
        BCS_Vitality). They work by name only; comparing their order raises ScriptError."""
        self.index = index
        self.engine_enums = re.compile(engine_enums) if engine_enums else None
        self.natives = dict(natives or {})
        self.methods = dict(methods or {})
        self.globals = dict(globals_ or {})

    # -- calls

    def call(self, name, args, this=None, path=None):
        if this is not None and (getattr(this, 'cls', None), name) in self.methods:
            return self.methods[(this.cls, name)](this, *args)
        if name in self.natives:
            return self.natives[name](*args)
        fn = self.index.function(name, path)
        if fn is None:
            raise ScriptError('no function %s' % name)
        params, _, body = fn.parsed()
        scope = {p: a for p, a in zip(params, args) if a is not None}
        try:
            self.run(body, scope, this, fn.path)
        except _Return as r:
            return r.value
        return None

    # -- statements

    def run(self, node, scope, this, path):
        kind = node[0]
        if kind == 'block':
            for s in node[1]:
                self.run(s, scope, this, path)
        elif kind == 'var':
            for n in node[1]:
                scope[n] = default_for(node[2])
        elif kind == 'expr':
            self.eval(node[1], scope, this, path)
        elif kind == 'if':
            if self.truthy(self.eval(node[1], scope, this, path)):
                self.run(node[2], scope, this, path)
            elif node[3] is not None:
                self.run(node[3], scope, this, path)
        elif kind == 'switch':
            subject = self.eval(node[1], scope, this, path)
            start = None
            for label, at in node[2]:
                if label is not None and self.equal(self.eval(label, scope, this, path), subject):
                    start = at
                    break
            if start is None:
                start = next((at for label, at in node[2] if label is None), None)
            if start is not None:
                try:
                    for s in node[3][start:]:
                        self.run(s, scope, this, path)
                except _Break:
                    pass
        elif kind == 'return':
            raise _Return(None if node[1] is None else self.eval(node[1], scope, this, path))
        elif kind == 'break':
            raise _Break()

    # -- expressions

    def eval(self, e, scope, this, path):
        kind = e[0]
        if kind == 'lit':
            return e[1]
        if kind == 'id':
            return self.lookup(e[1], scope, this)
        if kind == 'member':
            obj = self.eval(e[1], scope, this, path)
            if e[2] == 'params' and obj is self.globals.get('theGame'):
                return self.params
            if isinstance(obj, (Obj, dict)):
                if e[2] not in obj:
                    raise ScriptError('%s has no field %s' % (getattr(obj, 'cls', 'object'), e[2]))
                return obj[e[2]]
            if obj is self.params:
                return self.param(e[2])
            if isinstance(obj, AttributeValue) and e[2].startswith('value'):
                return tag(getattr(obj, e[2]), obj.src)
            return getattr(obj, e[2])
        if kind == 'index':
            return self.eval(e[1], scope, this, path)[self.eval(e[2], scope, this, path)]
        if kind == 'call':
            return self.eval_call(e, scope, this, path)
        if kind == 'unary':
            v = self.eval(e[2], scope, this, path)
            return (not self.truthy(v)) if e[1] == '!' else (self.neg(v) if e[1] == '-' else v)
        if kind == 'cast':
            v = self.eval(e[2], scope, this, path)
            if e[1] == 'int':
                return tag(int(v), src_of(v))
            return tag(float(v), src_of(v)) if e[1] == 'float' else v
        if kind == 'bin':
            op = e[1]
            if op == '&&':
                return self.truthy(self.eval(e[2], scope, this, path)) and self.truthy(self.eval(e[3], scope, this, path))
            if op == '||':
                return self.truthy(self.eval(e[2], scope, this, path)) or self.truthy(self.eval(e[3], scope, this, path))
            return self.binop(op, self.eval(e[2], scope, this, path), self.eval(e[3], scope, this, path))
        if kind == 'assign':
            return self.assign(e, scope, this, path)
        raise ScriptError('cannot evaluate %r' % (e,))

    def eval_call(self, e, scope, this, path):
        target, raw_args = e[1], e[2]
        if target[0] == 'member':
            obj = self.eval(target[1], scope, this, path)
            name = target[2]
            if isinstance(obj, list):
                return self.array_method(obj, name, [self.eval(a, scope, this, path) for a in raw_args if a])
        else:
            obj, name = this, target[1]
        # Out-parameters: natives get a setter for each argument that names a variable.
        if (getattr(obj, 'cls', None), name) in self.methods or name in self.natives:
            args = [None if a is None else self.eval(a, scope, this, path) for a in raw_args]
            outs = [(lambda v, a=a: self.store(a, v, scope, this, path)) if a is not None and a[0] in ('id', 'member')
                    else None for a in raw_args]
            fn = self.methods.get((getattr(obj, 'cls', None), name)) or self.natives[name]
            if getattr(fn, 'wants_outs', False):
                return fn(obj, args, outs) if (getattr(obj, 'cls', None), name) in self.methods else fn(args, outs)
            return self.call(name, args, obj, path)
        args = [None if a is None else self.eval(a, scope, this, path) for a in raw_args]
        fn = self.index.function(name, path)
        if fn is None:
            raise ScriptError('no function %s' % name)
        params, outs, body = fn.parsed()
        local = {p: a for p, a in zip(params, args) if a is not None}
        try:
            self.run(body, local, obj, fn.path)
            result = None
        except _Return as r:
            result = r.value
        for p, a in zip(params, raw_args):
            if p in outs and a is not None and p in local:
                self.store(a, local[p], scope, this, path)
        return result

    def array_method(self, arr, name, args):
        if name == 'PushBack':
            arr.append(args[0])
            return None
        if name == 'Size':
            return len(arr)
        raise ScriptError('array.%s is not supported' % name)

    def lookup(self, name, scope, this):
        if name in scope:
            return scope[name]
        if name == 'this':
            return this
        if isinstance(this, Obj) and name in this:
            return this[name]
        if name in self.globals:
            return self.globals[name]
        if name in self.index.enums:
            return self.index.enums[name]
        if self.engine_enums and self.engine_enums.match(name):
            return Enum(name, None)
        raise ScriptError('unknown name %s' % name)

    def store(self, target, value, scope, this, path):
        if target[0] == 'id':
            name = target[1]
            if name not in scope and isinstance(this, Obj) and name in this:
                this[name] = value
            else:
                scope[name] = value
        elif target[0] == 'member':
            obj = self.eval(target[1], scope, this, path)
            if isinstance(obj, (Obj, dict)):
                obj[target[2]] = value
            else:
                setattr(obj, target[2], value)
        else:
            raise ScriptError('cannot assign to %r' % (target,))

    def assign(self, e, scope, this, path):
        op, target, value = e[1], e[2], self.eval(e[3], scope, this, path)
        if op != '=':
            value = self.binop(op[0], self.eval(target, scope, this, path), value)
        elif isinstance(value, AttributeValue):
            value = value.copy()
        self.store(target, value, scope, this, path)
        return value

    # -- params (theGame.params.X: class defaults in gameParams.ws)

    params = object()

    def param(self, name):
        raw = self.index.defaults.get(name)
        if raw is None:
            raise ScriptError('no default for theGame.params.%s' % name)
        return self.eval(Parser(tokenize(raw)).expr(), {}, None, None)

    # -- value semantics

    @staticmethod
    def truthy(v):
        if isinstance(v, Enum):
            return v.value != 0
        return bool(v)

    @staticmethod
    def equal(a, b):
        if isinstance(a, Enum) or isinstance(b, Enum):
            return a == b
        return a == b

    @staticmethod
    def neg(v):
        if isinstance(v, AttributeValue):
            return v._map(lambda x: -x)
        return tag(-v, src_of(v))

    @staticmethod
    def binop(op, a, b):
        if isinstance(a, Enum) and isinstance(b, Enum) or isinstance(a, Enum) and isinstance(b, int):
            if op in ('==', '!='):
                return (a == b) == (op == '==')
            if a.value is None or isinstance(b, Enum) and b.value is None:
                raise ScriptError('order of engine enum %s is unknown' % a)
            a = a.value
            b = b.value if isinstance(b, Enum) else b
        if isinstance(a, AttributeValue) or isinstance(b, AttributeValue):
            return Interpreter.attr_op(op, a, b)
        if op == '+' and (isinstance(a, str) or isinstance(b, str)):
            return Concat.join(a, b)
        src = src_of(a) + tuple(s for s in src_of(b) if s not in src_of(a))
        if op == '+':
            r = a + b
        elif op == '-':
            r = a - b
        elif op == '*':
            r = a * b
        elif op == '/':
            r = int(a / b) if isinstance(a, int) and isinstance(b, int) and not isinstance(a, bool) else a / b
        elif op == '%':
            r = a % b
        elif op == '==':
            return a == b
        elif op == '!=':
            return a != b
        elif op == '<':
            return a < b
        elif op == '>':
            return a > b
        elif op == '<=':
            return a <= b
        elif op == '>=':
            return a >= b
        else:
            raise ScriptError('operator %s' % op)
        return tag(r, src)

    @staticmethod
    def attr_op(op, a, b):
        if isinstance(a, AttributeValue) and isinstance(b, AttributeValue):
            if op == '+':
                return AttributeValue(a.valueBase + b.valueBase, a.valueAdditive + b.valueAdditive,
                                      a.valueMultiplicative + b.valueMultiplicative, a.src + b.src)
            if op == '-':
                return AttributeValue(a.valueBase - b.valueBase, a.valueAdditive - b.valueAdditive,
                                      a.valueMultiplicative - b.valueMultiplicative, a.src + b.src)
        if isinstance(a, AttributeValue) and op in ('*', '/'):
            return a._map((lambda x: x * b) if op == '*' else (lambda x: x / b), src_of(b))
        if isinstance(b, AttributeValue) and op == '*':
            return b._map(lambda x: x * a, src_of(a))
        raise ScriptError('SAbilityAttributeValue %s %r' % (op, b))


class Concat(str):
    """A string built by the script. Numbers joined into it become `parts` markers, so callers can
    turn the text back into a template. Plain str subclass: compares and prints as the text."""

    MARK = '\x00%d\x00'

    def __new__(cls, text, parts=()):
        s = super().__new__(cls, text)
        s.parts = list(parts)
        return s

    def replace_first(self, old, value):
        """Replace the first `old` with a marker for `value` (a number or a string)."""
        head, found, tail = self.partition(old)
        if not found:
            return self
        if isinstance(value, str) and not isinstance(value, Concat):
            return Concat(head + value + tail, self.parts)
        return Concat(head + self.MARK % len(self.parts) + tail, self.parts + [value])

    @classmethod
    def join(cls, a, b):
        pa, ta = cls._piece(a, 0)
        pb, tb = cls._piece(b, len(pa))
        return cls(ta + tb, pa + pb)

    @classmethod
    def _piece(cls, v, offset):
        if isinstance(v, Concat):
            text = v
            for i in reversed(range(len(v.parts))):
                text = text.replace(cls.MARK % i, cls.MARK % (i + offset))
            return list(v.parts), str(text)
        if isinstance(v, str):
            return [], str(v)
        if isinstance(v, bool):
            return [], 'true' if v else 'false'
        return [v], cls.MARK % offset
