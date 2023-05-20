
(function(l, r) { if (!l || l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (self.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(self.document);
var app = (function () {
    'use strict';

    function noop() { }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    let src_url_equal_anchor;
    function src_url_equal(element_src, url) {
        if (!src_url_equal_anchor) {
            src_url_equal_anchor = document.createElement('a');
        }
        src_url_equal_anchor.href = url;
        return element_src === src_url_equal_anchor.href;
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }

    new Set();

    const globals = (typeof window !== 'undefined'
        ? window
        : typeof globalThis !== 'undefined'
            ? globalThis
            : global);
    // Needs to be written like this to pass the tree-shake-test
    'WeakMap' in globals ? new WeakMap() : undefined;
    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        if (node.parentNode) {
            node.parentNode.removeChild(node);
        }
    }
    function destroy_each(iterations, detaching) {
        for (let i = 0; i < iterations.length; i += 1) {
            if (iterations[i])
                iterations[i].d(detaching);
        }
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function empty() {
        return text('');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function prevent_default(fn) {
        return function (event) {
            event.preventDefault();
            // @ts-ignore
            return fn.call(this, event);
        };
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_input_value(input, value) {
        input.value = value == null ? '' : value;
    }
    function toggle_class(element, name, toggle) {
        element.classList[toggle ? 'add' : 'remove'](name);
    }
    function custom_event(type, detail, { bubbles = false, cancelable = false } = {}) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, bubbles, cancelable, detail);
        return e;
    }

    // we need to store the information for multiple documents because a Svelte application could also contain iframes
    // https://github.com/sveltejs/svelte/issues/3624
    new Map();

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error('Function called outside component initialization');
        return current_component;
    }
    /**
     * The `onMount` function schedules a callback to run as soon as the component has been mounted to the DOM.
     * It must be called during the component's initialisation (but doesn't need to live *inside* the component;
     * it can be called from an external module).
     *
     * `onMount` does not run inside a [server-side component](/docs#run-time-server-side-component-api).
     *
     * https://svelte.dev/docs#run-time-svelte-onmount
     */
    function onMount(fn) {
        get_current_component().$$.on_mount.push(fn);
    }
    /**
     * Creates an event dispatcher that can be used to dispatch [component events](/docs#template-syntax-component-directives-on-eventname).
     * Event dispatchers are functions that can take two arguments: `name` and `detail`.
     *
     * Component events created with `createEventDispatcher` create a
     * [CustomEvent](https://developer.mozilla.org/en-US/docs/Web/API/CustomEvent).
     * These events do not [bubble](https://developer.mozilla.org/en-US/docs/Learn/JavaScript/Building_blocks/Events#Event_bubbling_and_capture).
     * The `detail` argument corresponds to the [CustomEvent.detail](https://developer.mozilla.org/en-US/docs/Web/API/CustomEvent/detail)
     * property and can contain any type of data.
     *
     * https://svelte.dev/docs#run-time-svelte-createeventdispatcher
     */
    function createEventDispatcher() {
        const component = get_current_component();
        return (type, detail, { cancelable = false } = {}) => {
            const callbacks = component.$$.callbacks[type];
            if (callbacks) {
                // TODO are there situations where events could be dispatched
                // in a server (non-DOM) environment?
                const event = custom_event(type, detail, { cancelable });
                callbacks.slice().forEach(fn => {
                    fn.call(component, event);
                });
                return !event.defaultPrevented;
            }
            return true;
        };
    }

    const dirty_components = [];
    const binding_callbacks = [];
    let render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = /* @__PURE__ */ Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    function add_flush_callback(fn) {
        flush_callbacks.push(fn);
    }
    // flush() calls callbacks in this order:
    // 1. All beforeUpdate callbacks, in order: parents before children
    // 2. All bind:this callbacks, in reverse order: children before parents.
    // 3. All afterUpdate callbacks, in order: parents before children. EXCEPT
    //    for afterUpdates called during the initial onMount, which are called in
    //    reverse order: children before parents.
    // Since callbacks might update component values, which could trigger another
    // call to flush(), the following steps guard against this:
    // 1. During beforeUpdate, any updated components will be added to the
    //    dirty_components array and will cause a reentrant call to flush(). Because
    //    the flush index is kept outside the function, the reentrant call will pick
    //    up where the earlier call left off and go through all dirty components. The
    //    current_component value is saved and restored so that the reentrant call will
    //    not interfere with the "parent" flush() call.
    // 2. bind:this callbacks cannot trigger new flush() calls.
    // 3. During afterUpdate, any updated components will NOT have their afterUpdate
    //    callback called a second time; the seen_callbacks set, outside the flush()
    //    function, guarantees this behavior.
    const seen_callbacks = new Set();
    let flushidx = 0; // Do *not* move this inside the flush() function
    function flush() {
        // Do not reenter flush while dirty components are updated, as this can
        // result in an infinite loop. Instead, let the inner flush handle it.
        // Reentrancy is ok afterwards for bindings etc.
        if (flushidx !== 0) {
            return;
        }
        const saved_component = current_component;
        do {
            // first, call beforeUpdate functions
            // and update components
            try {
                while (flushidx < dirty_components.length) {
                    const component = dirty_components[flushidx];
                    flushidx++;
                    set_current_component(component);
                    update(component.$$);
                }
            }
            catch (e) {
                // reset dirty state to not end up in a deadlocked state and then rethrow
                dirty_components.length = 0;
                flushidx = 0;
                throw e;
            }
            set_current_component(null);
            dirty_components.length = 0;
            flushidx = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        seen_callbacks.clear();
        set_current_component(saved_component);
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    /**
     * Useful for example to execute remaining `afterUpdate` callbacks before executing `destroy`.
     */
    function flush_render_callbacks(fns) {
        const filtered = [];
        const targets = [];
        render_callbacks.forEach((c) => fns.indexOf(c) === -1 ? filtered.push(c) : targets.push(c));
        targets.forEach((c) => c());
        render_callbacks = filtered;
    }
    const outroing = new Set();
    let outros;
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
        else if (callback) {
            callback();
        }
    }

    const _boolean_attributes = [
        'allowfullscreen',
        'allowpaymentrequest',
        'async',
        'autofocus',
        'autoplay',
        'checked',
        'controls',
        'default',
        'defer',
        'disabled',
        'formnovalidate',
        'hidden',
        'inert',
        'ismap',
        'loop',
        'multiple',
        'muted',
        'nomodule',
        'novalidate',
        'open',
        'playsinline',
        'readonly',
        'required',
        'reversed',
        'selected'
    ];
    /**
     * List of HTML boolean attributes (e.g. `<input disabled>`).
     * Source: https://html.spec.whatwg.org/multipage/indices.html
     */
    new Set([..._boolean_attributes]);

    function bind(component, name, callback) {
        const index = component.$$.props[name];
        if (index !== undefined) {
            component.$$.bound[index] = callback;
            callback(component.$$.ctx[index]);
        }
    }
    function create_component(block) {
        block && block.c();
    }
    function mount_component(component, target, anchor, customElement) {
        const { fragment, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        if (!customElement) {
            // onMount happens before the initial afterUpdate
            add_render_callback(() => {
                const new_on_destroy = component.$$.on_mount.map(run).filter(is_function);
                // if the component was destroyed immediately
                // it will update the `$$.on_destroy` reference to `null`.
                // the destructured on_destroy may still reference to the old array
                if (component.$$.on_destroy) {
                    component.$$.on_destroy.push(...new_on_destroy);
                }
                else {
                    // Edge case - component was destroyed immediately,
                    // most likely as a result of a binding initialising
                    run_all(new_on_destroy);
                }
                component.$$.on_mount = [];
            });
        }
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            flush_render_callbacks($$.after_update);
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, append_styles, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const $$ = component.$$ = {
            fragment: null,
            ctx: [],
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            on_disconnect: [],
            before_update: [],
            after_update: [],
            context: new Map(options.context || (parent_component ? parent_component.$$.context : [])),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false,
            root: options.target || parent_component.$$.root
        };
        append_styles && append_styles($$.root);
        let ready = false;
        $$.ctx = instance
            ? instance(component, options.props || {}, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor, options.customElement);
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            if (!is_function(callback)) {
                return noop;
            }
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.59.1' }, detail), { bubbles: true }));
    }
    function append_dev(target, node) {
        dispatch_dev('SvelteDOMInsert', { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev('SvelteDOMInsert', { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev('SvelteDOMRemove', { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation, has_stop_immediate_propagation) {
        const modifiers = options === true ? ['capture'] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        if (has_stop_immediate_propagation)
            modifiers.push('stopImmediatePropagation');
        dispatch_dev('SvelteDOMAddEventListener', { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev('SvelteDOMRemoveEventListener', { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev('SvelteDOMRemoveAttribute', { node, attribute });
        else
            dispatch_dev('SvelteDOMSetAttribute', { node, attribute, value });
    }
    function prop_dev(node, property, value) {
        node[property] = value;
        dispatch_dev('SvelteDOMSetProperty', { node, property, value });
    }
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.data === data)
            return;
        dispatch_dev('SvelteDOMSetData', { node: text, data });
        text.data = data;
    }
    function validate_each_argument(arg) {
        if (typeof arg !== 'string' && !(arg && typeof arg === 'object' && 'length' in arg)) {
            let msg = '{#each} only iterates over array-like objects.';
            if (typeof Symbol === 'function' && arg && Symbol.iterator in arg) {
                msg += ' You can use a spread to convert this iterable into an array.';
            }
            throw new Error(msg);
        }
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    /**
     * Base class for Svelte components with some minor dev-enhancements. Used when dev=true.
     */
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error("'target' is a required option");
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn('Component was already destroyed'); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    var data = [
    	{
    		id: 1,
    		"mekan-ismi": "Lezzet Köşesi",
    		kategori: "kahvaltı",
    		"şehir": "İstanbul"
    	},
    	{
    		id: 2,
    		"mekan-ismi": "Burger Dünyası",
    		kategori: "burger",
    		"şehir": "Ankara"
    	},
    	{
    		id: 3,
    		"mekan-ismi": "Kebapçı Mehmet Usta",
    		kategori: "kebap",
    		"şehir": "İzmir"
    	},
    	{
    		id: 4,
    		"mekan-ismi": "Baran Pub",
    		kategori: "içki",
    		"şehir": "Antalya"
    	},
    	{
    		id: 5,
    		"mekan-ismi": "Kahve Durağı",
    		kategori: "kahvaltı",
    		"şehir": "Bursa"
    	},
    	{
    		id: 6,
    		"mekan-ismi": "Pizza Delisi",
    		kategori: "pizza",
    		"şehir": "İzmir"
    	},
    	{
    		id: 7,
    		"mekan-ismi": "Mangal Keyfi",
    		kategori: "kebap",
    		"şehir": "Adana"
    	},
    	{
    		id: 8,
    		"mekan-ismi": "Cafe Nostalji",
    		kategori: "kahvaltı",
    		"şehir": "Trabzon"
    	},
    	{
    		id: 9,
    		"mekan-ismi": "Pub 34",
    		kategori: "içki",
    		"şehir": "İzmit"
    	},
    	{
    		id: 10,
    		"mekan-ismi": "Tostçu Hüseyin",
    		kategori: "tost",
    		"şehir": "Gaziantep"
    	},
    	{
    		id: 11,
    		"mekan-ismi": "Köfteci Ali Baba",
    		kategori: "hızlı-yemek",
    		"şehir": "Antakya"
    	},
    	{
    		id: 12,
    		"mekan-ismi": "Fish & Chips",
    		kategori: "deniz-mahsulleri",
    		"şehir": "Alanya"
    	},
    	{
    		id: 13,
    		"mekan-ismi": "Kumpir Dünyası",
    		kategori: "atıştırmalık",
    		"şehir": "Muğla"
    	},
    	{
    		id: 14,
    		"mekan-ismi": "Cafe Moda",
    		kategori: "kahve",
    		"şehir": "Eskişehir"
    	},
    	{
    		id: 15,
    		"mekan-ismi": "Dönerci Hasan",
    		kategori: "kebap",
    		"şehir": "Isparta"
    	},
    	{
    		id: 16,
    		"mekan-ismi": "Sushi House",
    		kategori: "sushi",
    		"şehir": "Bodrum"
    	},
    	{
    		id: 17,
    		"mekan-ismi": "Pide Pazarı",
    		kategori: "pide",
    		"şehir": "Trabzon"
    	},
    	{
    		id: 18,
    		"mekan-ismi": "Çay Bahçesi",
    		kategori: "kahvaltı",
    		"şehir": "Van"
    	},
    	{
    		id: 19,
    		"mekan-ismi": "Bira Evi",
    		kategori: "içki",
    		"şehir": "Bodrum"
    	},
    	{
    		id: 20,
    		"mekan-ismi": "Köy Kahvaltısı",
    		kategori: "kahvaltı",
    		"şehir": "Trabzon"
    	},
    	{
    		id: 21,
    		"mekan-ismi": "Balıkesir Kahvaltısı",
    		kategori: "kahvaltı",
    		"şehir": "Balıkesir"
    	}
    ];
    var data$1 = {
    	data: data
    };

    /* src/searchBar.svelte generated by Svelte v3.59.1 */
    const file$5 = "src/searchBar.svelte";

    function create_fragment$6(ctx) {
    	let div;
    	let input;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			div = element("div");
    			input = element("input");
    			attr_dev(input, "type", "text");
    			attr_dev(input, "placeholder", "Mekan ara...");
    			add_location(input, file$5, 12, 4, 241);
    			attr_dev(div, "class", "svelte-1iw5xc0");
    			add_location(div, file$5, 11, 2, 231);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, input);
    			set_input_value(input, /*searchQuery*/ ctx[0]);

    			if (!mounted) {
    				dispose = [
    					listen_dev(input, "input", /*input_input_handler*/ ctx[2]),
    					listen_dev(input, "input", /*handleSearch*/ ctx[1], false, false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*searchQuery*/ 1 && input.value !== /*searchQuery*/ ctx[0]) {
    				set_input_value(input, /*searchQuery*/ ctx[0]);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$6.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$6($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('SearchBar', slots, []);
    	const dispatch = createEventDispatcher();
    	let searchQuery = '';

    	function handleSearch() {
    		dispatch('search', searchQuery);
    	}

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<SearchBar> was created with unknown prop '${key}'`);
    	});

    	function input_input_handler() {
    		searchQuery = this.value;
    		$$invalidate(0, searchQuery);
    	}

    	$$self.$capture_state = () => ({
    		createEventDispatcher,
    		dispatch,
    		searchQuery,
    		handleSearch
    	});

    	$$self.$inject_state = $$props => {
    		if ('searchQuery' in $$props) $$invalidate(0, searchQuery = $$props.searchQuery);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [searchQuery, handleSearch, input_input_handler];
    }

    class SearchBar extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$6, create_fragment$6, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "SearchBar",
    			options,
    			id: create_fragment$6.name
    		});
    	}
    }

    /* src/citiesFilter.svelte generated by Svelte v3.59.1 */
    const file$4 = "src/citiesFilter.svelte";

    function get_each_context$3(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[4] = list[i];
    	return child_ctx;
    }

    // (16:6) {#each cities as city}
    function create_each_block$3(ctx) {
    	let option;
    	let t_value = /*city*/ ctx[4] + "";
    	let t;

    	const block = {
    		c: function create() {
    			option = element("option");
    			t = text(t_value);
    			option.__value = /*city*/ ctx[4];
    			option.value = option.__value;
    			add_location(option, file$4, 16, 8, 483);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, option, anchor);
    			append_dev(option, t);
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(option);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block$3.name,
    		type: "each",
    		source: "(16:6) {#each cities as city}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$5(ctx) {
    	let div;
    	let select;
    	let option;
    	let mounted;
    	let dispose;
    	let each_value = /*cities*/ ctx[0];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block$3(get_each_context$3(ctx, each_value, i));
    	}

    	const block = {
    		c: function create() {
    			div = element("div");
    			select = element("select");
    			option = element("option");
    			option.textContent = "Tüm Şehirler";

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			option.__value = "";
    			option.value = option.__value;
    			add_location(option, file$4, 14, 6, 407);
    			add_location(select, file$4, 13, 4, 334);
    			attr_dev(div, "class", "svelte-1iw5xc0");
    			add_location(div, file$4, 12, 2, 324);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, select);
    			append_dev(select, option);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				if (each_blocks[i]) {
    					each_blocks[i].m(select, null);
    				}
    			}

    			if (!mounted) {
    				dispose = listen_dev(select, "change", /*change_handler*/ ctx[2], false, false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*cities*/ 1) {
    				each_value = /*cities*/ ctx[0];
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context$3(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block$3(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(select, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			destroy_each(each_blocks, detaching);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$5.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$5($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('CitiesFilter', slots, []);
    	const dispatch = createEventDispatcher();
    	let cities = Array.from(new Set(data$1.data.map(item => item.şehir)));

    	function handleCityFilter(city) {
    		dispatch('cityFilter', city);
    	}

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<CitiesFilter> was created with unknown prop '${key}'`);
    	});

    	const change_handler = event => handleCityFilter(event.target.value);

    	$$self.$capture_state = () => ({
    		data: data$1,
    		createEventDispatcher,
    		dispatch,
    		cities,
    		handleCityFilter
    	});

    	$$self.$inject_state = $$props => {
    		if ('cities' in $$props) $$invalidate(0, cities = $$props.cities);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [cities, handleCityFilter, change_handler];
    }

    class CitiesFilter extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$5, create_fragment$5, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "CitiesFilter",
    			options,
    			id: create_fragment$5.name
    		});
    	}
    }

    /* src/categoryFilter.svelte generated by Svelte v3.59.1 */

    const { console: console_1$2 } = globals;
    const file$3 = "src/categoryFilter.svelte";

    function get_each_context$2(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[5] = list[i];
    	return child_ctx;
    }

    // (21:2) {#each categories as category}
    function create_each_block$2(ctx) {
    	let button;
    	let img;
    	let img_src_value;
    	let t;
    	let mounted;
    	let dispose;

    	function click_handler() {
    		return /*click_handler*/ ctx[4](/*category*/ ctx[5]);
    	}

    	const block = {
    		c: function create() {
    			button = element("button");
    			img = element("img");
    			t = space();
    			if (!src_url_equal(img.src, img_src_value = `./icons/${/*category*/ ctx[5]}.svg`)) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", /*category*/ ctx[5]);
    			add_location(img, file$3, 25, 6, 652);
    			attr_dev(button, "class", "svelte-99m9qk");
    			toggle_class(button, "selected", /*selectedCategory*/ ctx[0] === /*category*/ ctx[5]);
    			add_location(button, file$3, 21, 4, 525);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, button, anchor);
    			append_dev(button, img);
    			append_dev(button, t);

    			if (!mounted) {
    				dispose = listen_dev(button, "click", click_handler, false, false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;

    			if (dirty & /*selectedCategory, categories*/ 3) {
    				toggle_class(button, "selected", /*selectedCategory*/ ctx[0] === /*category*/ ctx[5]);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(button);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block$2.name,
    		type: "each",
    		source: "(21:2) {#each categories as category}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$4(ctx) {
    	let div;
    	let each_value = /*categories*/ ctx[1];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block$2(get_each_context$2(ctx, each_value, i));
    	}

    	const block = {
    		c: function create() {
    			div = element("div");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			add_location(div, file$3, 19, 0, 482);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				if (each_blocks[i]) {
    					each_blocks[i].m(div, null);
    				}
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*selectedCategory, categories, handleCategoryFilter*/ 7) {
    				each_value = /*categories*/ ctx[1];
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context$2(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block$2(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(div, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			destroy_each(each_blocks, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$4.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$4($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('CategoryFilter', slots, []);
    	let { selectedCategory = '' } = $$props;

    	let { onCategoryFilter = () => {
    		
    	} } = $$props;

    	const categories = Array.from(new Set(data$1.data.map(mekan => mekan.kategori)));

    	function handleCategoryFilter(category) {
    		if (selectedCategory === category) {
    			$$invalidate(0, selectedCategory = '');
    		} else {
    			$$invalidate(0, selectedCategory = category);
    			console.log(selectedCategory, 'seçildi');
    		}

    		onCategoryFilter(selectedCategory);
    	}

    	const writable_props = ['selectedCategory', 'onCategoryFilter'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console_1$2.warn(`<CategoryFilter> was created with unknown prop '${key}'`);
    	});

    	const click_handler = category => handleCategoryFilter(category);

    	$$self.$$set = $$props => {
    		if ('selectedCategory' in $$props) $$invalidate(0, selectedCategory = $$props.selectedCategory);
    		if ('onCategoryFilter' in $$props) $$invalidate(3, onCategoryFilter = $$props.onCategoryFilter);
    	};

    	$$self.$capture_state = () => ({
    		data: data$1,
    		selectedCategory,
    		onCategoryFilter,
    		categories,
    		handleCategoryFilter
    	});

    	$$self.$inject_state = $$props => {
    		if ('selectedCategory' in $$props) $$invalidate(0, selectedCategory = $$props.selectedCategory);
    		if ('onCategoryFilter' in $$props) $$invalidate(3, onCategoryFilter = $$props.onCategoryFilter);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		selectedCategory,
    		categories,
    		handleCategoryFilter,
    		onCategoryFilter,
    		click_handler
    	];
    }

    class CategoryFilter extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$4, create_fragment$4, safe_not_equal, { selectedCategory: 0, onCategoryFilter: 3 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "CategoryFilter",
    			options,
    			id: create_fragment$4.name
    		});
    	}

    	get selectedCategory() {
    		throw new Error("<CategoryFilter>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set selectedCategory(value) {
    		throw new Error("<CategoryFilter>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get onCategoryFilter() {
    		throw new Error("<CategoryFilter>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set onCategoryFilter(value) {
    		throw new Error("<CategoryFilter>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/restaurantList.svelte generated by Svelte v3.59.1 */

    const { console: console_1$1 } = globals;
    const file$2 = "src/restaurantList.svelte";

    function get_each_context$1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[10] = list[i];
    	return child_ctx;
    }

    // (57:10) {#if (!selectedCity || mekan.şehir === selectedCity) && (!selectedCategory || mekan.kategori === selectedCategory)}
    function create_if_block(ctx) {
    	let li;
    	let t_value = /*mekan*/ ctx[10]['mekan-ismi'] + "";
    	let t;

    	const block = {
    		c: function create() {
    			li = element("li");
    			t = text(t_value);
    			attr_dev(li, "class", "svelte-e137r9");
    			add_location(li, file$2, 57, 12, 1717);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, li, anchor);
    			append_dev(li, t);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*filteredMekanlar*/ 1 && t_value !== (t_value = /*mekan*/ ctx[10]['mekan-ismi'] + "")) set_data_dev(t, t_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(li);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(57:10) {#if (!selectedCity || mekan.şehir === selectedCity) && (!selectedCategory || mekan.kategori === selectedCategory)}",
    		ctx
    	});

    	return block;
    }

    // (56:8) {#each filteredMekanlar as mekan}
    function create_each_block$1(ctx) {
    	let if_block_anchor;
    	let if_block = (!/*selectedCity*/ ctx[1] || /*mekan*/ ctx[10].şehir === /*selectedCity*/ ctx[1]) && (!/*selectedCategory*/ ctx[2] || /*mekan*/ ctx[10].kategori === /*selectedCategory*/ ctx[2]) && create_if_block(ctx);

    	const block = {
    		c: function create() {
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			if (if_block) if_block.m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if ((!/*selectedCity*/ ctx[1] || /*mekan*/ ctx[10].şehir === /*selectedCity*/ ctx[1]) && (!/*selectedCategory*/ ctx[2] || /*mekan*/ ctx[10].kategori === /*selectedCategory*/ ctx[2])) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block(ctx);
    					if_block.c();
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}
    		},
    		d: function destroy(detaching) {
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block$1.name,
    		type: "each",
    		source: "(56:8) {#each filteredMekanlar as mekan}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$3(ctx) {
    	let main;
    	let h1;
    	let t1;
    	let searchbar;
    	let t2;
    	let citiesfilter;
    	let t3;
    	let categoryfilter;
    	let updating_selectedCategory;
    	let t4;
    	let ul;
    	let current;
    	searchbar = new SearchBar({ $$inline: true });
    	searchbar.$on("search", /*handleSearch*/ ctx[3]);

    	citiesfilter = new CitiesFilter({
    			props: { selectedCity: /*selectedCity*/ ctx[1] },
    			$$inline: true
    		});

    	citiesfilter.$on("cityFilter", /*handleCityFilter*/ ctx[5]);

    	function categoryfilter_selectedCategory_binding(value) {
    		/*categoryfilter_selectedCategory_binding*/ ctx[6](value);
    	}

    	let categoryfilter_props = {};

    	if (/*selectedCategory*/ ctx[2] !== void 0) {
    		categoryfilter_props.selectedCategory = /*selectedCategory*/ ctx[2];
    	}

    	categoryfilter = new CategoryFilter({
    			props: categoryfilter_props,
    			$$inline: true
    		});

    	binding_callbacks.push(() => bind(categoryfilter, 'selectedCategory', categoryfilter_selectedCategory_binding));
    	categoryfilter.$on("categoryFilter", /*handleCategoryFilter*/ ctx[4]);
    	let each_value = /*filteredMekanlar*/ ctx[0];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block$1(get_each_context$1(ctx, each_value, i));
    	}

    	const block = {
    		c: function create() {
    			main = element("main");
    			h1 = element("h1");
    			h1.textContent = "Restoran Listesi";
    			t1 = space();
    			create_component(searchbar.$$.fragment);
    			t2 = space();
    			create_component(citiesfilter.$$.fragment);
    			t3 = space();
    			create_component(categoryfilter.$$.fragment);
    			t4 = space();
    			ul = element("ul");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			add_location(h1, file$2, 48, 4, 1287);
    			attr_dev(ul, "class", "svelte-e137r9");
    			add_location(ul, file$2, 54, 4, 1532);
    			add_location(main, file$2, 47, 2, 1276);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, main, anchor);
    			append_dev(main, h1);
    			append_dev(main, t1);
    			mount_component(searchbar, main, null);
    			append_dev(main, t2);
    			mount_component(citiesfilter, main, null);
    			append_dev(main, t3);
    			mount_component(categoryfilter, main, null);
    			append_dev(main, t4);
    			append_dev(main, ul);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				if (each_blocks[i]) {
    					each_blocks[i].m(ul, null);
    				}
    			}

    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			const citiesfilter_changes = {};
    			if (dirty & /*selectedCity*/ 2) citiesfilter_changes.selectedCity = /*selectedCity*/ ctx[1];
    			citiesfilter.$set(citiesfilter_changes);
    			const categoryfilter_changes = {};

    			if (!updating_selectedCategory && dirty & /*selectedCategory*/ 4) {
    				updating_selectedCategory = true;
    				categoryfilter_changes.selectedCategory = /*selectedCategory*/ ctx[2];
    				add_flush_callback(() => updating_selectedCategory = false);
    			}

    			categoryfilter.$set(categoryfilter_changes);

    			if (dirty & /*filteredMekanlar, selectedCity, selectedCategory*/ 7) {
    				each_value = /*filteredMekanlar*/ ctx[0];
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context$1(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block$1(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(ul, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(searchbar.$$.fragment, local);
    			transition_in(citiesfilter.$$.fragment, local);
    			transition_in(categoryfilter.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(searchbar.$$.fragment, local);
    			transition_out(citiesfilter.$$.fragment, local);
    			transition_out(categoryfilter.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(main);
    			destroy_component(searchbar);
    			destroy_component(citiesfilter);
    			destroy_component(categoryfilter);
    			destroy_each(each_blocks, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$3.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$3($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('RestaurantList', slots, []);
    	let mekanlar = data$1.data;
    	let filteredMekanlar = mekanlar;
    	let selectedCity = '';
    	let selectedCategory = '';
    	let searchQuery = '';

    	function handleSearch(event) {
    		searchQuery = event.detail.toLowerCase();
    		applyCityFilter();
    	}

    	function handleCategoryFilter(event) {
    		$$invalidate(2, selectedCategory = event.detail);
    	}

    	function handleCityFilter(event) {
    		$$invalidate(1, selectedCity = event.detail);
    		applyCityFilter();
    	}

    	function applyCityFilter() {
    		if (selectedCity) {
    			$$invalidate(0, filteredMekanlar = mekanlar.filter(mekan => mekan.şehir === selectedCity && mekan['mekan-ismi'].toLowerCase().startsWith(searchQuery)));
    			console.log(selectedCity, 'seçildi');
    		} else {
    			$$invalidate(0, filteredMekanlar = mekanlar.filter(mekan => mekan['mekan-ismi'].toLowerCase().startsWith(searchQuery)));
    			console.log('Hiçbir şehir seçilmedi');
    		}
    	}

    	onMount(() => {
    		applyCityFilter();
    	});

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console_1$1.warn(`<RestaurantList> was created with unknown prop '${key}'`);
    	});

    	function categoryfilter_selectedCategory_binding(value) {
    		selectedCategory = value;
    		$$invalidate(2, selectedCategory);
    	}

    	$$self.$capture_state = () => ({
    		data: data$1,
    		SearchBar,
    		CitiesFilter,
    		onMount,
    		CategoryFilter,
    		mekanlar,
    		filteredMekanlar,
    		selectedCity,
    		selectedCategory,
    		searchQuery,
    		handleSearch,
    		handleCategoryFilter,
    		handleCityFilter,
    		applyCityFilter
    	});

    	$$self.$inject_state = $$props => {
    		if ('mekanlar' in $$props) mekanlar = $$props.mekanlar;
    		if ('filteredMekanlar' in $$props) $$invalidate(0, filteredMekanlar = $$props.filteredMekanlar);
    		if ('selectedCity' in $$props) $$invalidate(1, selectedCity = $$props.selectedCity);
    		if ('selectedCategory' in $$props) $$invalidate(2, selectedCategory = $$props.selectedCategory);
    		if ('searchQuery' in $$props) searchQuery = $$props.searchQuery;
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		filteredMekanlar,
    		selectedCity,
    		selectedCategory,
    		handleSearch,
    		handleCategoryFilter,
    		handleCityFilter,
    		categoryfilter_selectedCategory_binding
    	];
    }

    class RestaurantList extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$3, create_fragment$3, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "RestaurantList",
    			options,
    			id: create_fragment$3.name
    		});
    	}
    }

    /* src/Geolocation.svelte generated by Svelte v3.59.1 */

    const { console: console_1 } = globals;

    function create_fragment$2(ctx) {
    	const block = {
    		c: noop,
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: noop,
    		p: noop,
    		i: noop,
    		o: noop,
    		d: noop
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$2.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function handleGeolocationPermission() {
    	if ("geolocation" in navigator) {
    		navigator.geolocation.getCurrentPosition(handleGeolocationSuccess, handleGeolocationError);
    	} else {
    		console.log("Tarayıcınızda konum hizmetleri desteklenmiyor.");
    	}
    }

    function handleGeolocationSuccess(position) {
    	const latitude = position.coords.latitude;
    	const longitude = position.coords.longitude;

    	// İl bilgisini almak için konum verilerini kullanabilirsiniz
    	// Bu örnekte, OpenCage Geocoding API kullanarak il bilgisini alıyoruz
    	const apiKey = "be437a385f5e439c9f1da91c99a750f0"; // API anahtarınızı buraya yerleştirin

    	const apiUrl = `https://api.opencagedata.com/geocode/v1/json?key=${apiKey}&q=${latitude},${longitude}&pretty=1`;

    	fetch(apiUrl).then(response => response.json()).then(data => {
    		const city = data.results[0].components.state;
    		console.log("Konumun il bilgisi:", city);
    	}).catch(error => {
    		console.log("İl bilgisi alınırken bir hata oluştu:", error);
    	});
    }

    function handleGeolocationError(error) {
    	console.log("Konum bilgisi alınamadı:", error.message);
    }

    function instance$2($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Geolocation', slots, []);
    	onMount(handleGeolocationPermission);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console_1.warn(`<Geolocation> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({
    		onMount,
    		handleGeolocationPermission,
    		handleGeolocationSuccess,
    		handleGeolocationError
    	});

    	return [];
    }

    class Geolocation extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$2, create_fragment$2, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Geolocation",
    			options,
    			id: create_fragment$2.name
    		});
    	}
    }

    /* src/form.svelte generated by Svelte v3.59.1 */
    const file$1 = "src/form.svelte";

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[3] = list[i];
    	return child_ctx;
    }

    // (33:8) {#each iller as il}
    function create_each_block(ctx) {
    	let option;
    	let t_value = /*il*/ ctx[3] + "";
    	let t;
    	let option_value_value;

    	const block = {
    		c: function create() {
    			option = element("option");
    			t = text(t_value);
    			option.__value = option_value_value = /*il*/ ctx[3];
    			option.value = option.__value;
    			add_location(option, file$1, 33, 10, 1203);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, option, anchor);
    			append_dev(option, t);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*iller*/ 1 && t_value !== (t_value = /*il*/ ctx[3] + "")) set_data_dev(t, t_value);

    			if (dirty & /*iller*/ 1 && option_value_value !== (option_value_value = /*il*/ ctx[3])) {
    				prop_dev(option, "__value", option_value_value);
    				option.value = option.__value;
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(option);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block.name,
    		type: "each",
    		source: "(33:8) {#each iller as il}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$1(ctx) {
    	let form;
    	let div0;
    	let label0;
    	let t1;
    	let input0;
    	let t2;
    	let div1;
    	let label1;
    	let t4;
    	let select;
    	let option;
    	let t6;
    	let div2;
    	let label2;
    	let t8;
    	let input1;
    	let t9;
    	let button;
    	let mounted;
    	let dispose;
    	let each_value = /*iller*/ ctx[0];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	const block = {
    		c: function create() {
    			form = element("form");
    			div0 = element("div");
    			label0 = element("label");
    			label0.textContent = "Mekan İsmi:";
    			t1 = space();
    			input0 = element("input");
    			t2 = space();
    			div1 = element("div");
    			label1 = element("label");
    			label1.textContent = "İl:";
    			t4 = space();
    			select = element("select");
    			option = element("option");
    			option.textContent = "İl Seçiniz";

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t6 = space();
    			div2 = element("div");
    			label2 = element("label");
    			label2.textContent = "Menü QR Linki:";
    			t8 = space();
    			input1 = element("input");
    			t9 = space();
    			button = element("button");
    			button.textContent = "Gönder";
    			attr_dev(label0, "for", "mekanIsmi");
    			add_location(label0, file$1, 25, 6, 938);
    			attr_dev(input0, "type", "text");
    			attr_dev(input0, "id", "mekanIsmi");
    			input0.required = true;
    			add_location(input0, file$1, 26, 6, 987);
    			add_location(div0, file$1, 24, 4, 926);
    			attr_dev(label1, "for", "il");
    			add_location(label1, file$1, 29, 6, 1060);
    			option.__value = "";
    			option.value = option.__value;
    			add_location(option, file$1, 31, 8, 1128);
    			attr_dev(select, "id", "il");
    			select.required = true;
    			add_location(select, file$1, 30, 6, 1094);
    			add_location(div1, file$1, 28, 4, 1048);
    			attr_dev(label2, "for", "qrLink");
    			add_location(label2, file$1, 38, 6, 1295);
    			attr_dev(input1, "type", "text");
    			attr_dev(input1, "id", "qrLink");
    			add_location(input1, file$1, 39, 6, 1344);
    			add_location(div2, file$1, 37, 4, 1283);
    			attr_dev(button, "type", "submit");
    			add_location(button, file$1, 41, 4, 1393);
    			add_location(form, file$1, 23, 2, 875);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, form, anchor);
    			append_dev(form, div0);
    			append_dev(div0, label0);
    			append_dev(div0, t1);
    			append_dev(div0, input0);
    			append_dev(form, t2);
    			append_dev(form, div1);
    			append_dev(div1, label1);
    			append_dev(div1, t4);
    			append_dev(div1, select);
    			append_dev(select, option);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				if (each_blocks[i]) {
    					each_blocks[i].m(select, null);
    				}
    			}

    			append_dev(form, t6);
    			append_dev(form, div2);
    			append_dev(div2, label2);
    			append_dev(div2, t8);
    			append_dev(div2, input1);
    			append_dev(form, t9);
    			append_dev(form, button);

    			if (!mounted) {
    				dispose = listen_dev(form, "submit", prevent_default(handleSubmit), false, true, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*iller*/ 1) {
    				each_value = /*iller*/ ctx[0];
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(select, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(form);
    			destroy_each(each_blocks, detaching);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$1.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function handleSubmit() {
    	
    } // Form verilerini işleme devam et

    function instance$1($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Form', slots, []);
    	const dispatch = createEventDispatcher();
    	let iller = [];

    	async function fetchIller() {
    		const apiKey = 'be437a385f5e439c9f1da91c99a750f0'; // Opencage API anahtarınızı buraya girin
    		const response = await fetch(`https://api.opencagedata.com/geocode/v1/json?q=turkey&countrycode=tr&limit=500&key=${apiKey}`);
    		const data = await response.json();

    		$$invalidate(0, iller = data.results.filter(result => result.components.city || result.components.town).map(result => result.components.city || result.components.town)); // Şehir veya kasaba bileşeni olan sonuçları filtrele
    		// Şehir veya kasaba bileşenini al
    	}

    	onMount(fetchIller);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Form> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({
    		onMount,
    		createEventDispatcher,
    		dispatch,
    		iller,
    		fetchIller,
    		handleSubmit
    	});

    	$$self.$inject_state = $$props => {
    		if ('iller' in $$props) $$invalidate(0, iller = $$props.iller);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [iller];
    }

    class Form extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Form",
    			options,
    			id: create_fragment$1.name
    		});
    	}
    }

    /* src/App.svelte generated by Svelte v3.59.1 */
    const file = "src/App.svelte";

    function create_fragment(ctx) {
    	let main;
    	let h1;
    	let t1;
    	let restaurantlist;
    	let t2;
    	let form;
    	let t3;
    	let geolocation;
    	let current;
    	restaurantlist = new RestaurantList({ $$inline: true });
    	form = new Form({ $$inline: true });
    	geolocation = new Geolocation({ $$inline: true });

    	const block = {
    		c: function create() {
    			main = element("main");
    			h1 = element("h1");
    			h1.textContent = "Menüler";
    			t1 = space();
    			create_component(restaurantlist.$$.fragment);
    			t2 = space();
    			create_component(form.$$.fragment);
    			t3 = space();
    			create_component(geolocation.$$.fragment);
    			attr_dev(h1, "class", "svelte-rtn3eg");
    			add_location(h1, file, 7, 1, 172);
    			add_location(main, file, 6, 2, 164);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, main, anchor);
    			append_dev(main, h1);
    			append_dev(main, t1);
    			mount_component(restaurantlist, main, null);
    			append_dev(main, t2);
    			mount_component(form, main, null);
    			append_dev(main, t3);
    			mount_component(geolocation, main, null);
    			current = true;
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;
    			transition_in(restaurantlist.$$.fragment, local);
    			transition_in(form.$$.fragment, local);
    			transition_in(geolocation.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(restaurantlist.$$.fragment, local);
    			transition_out(form.$$.fragment, local);
    			transition_out(geolocation.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(main);
    			destroy_component(restaurantlist);
    			destroy_component(form);
    			destroy_component(geolocation);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('App', slots, []);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({ RestaurantList, Geolocation, Form });
    	return [];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment.name
    		});
    	}
    }

    const app = new App({
    	target: document.body,
    	props: {
    		name: 'world'
    	}
    });

    return app;

})();
//# sourceMappingURL=bundle.js.map
