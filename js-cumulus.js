= null && event.clientX !== null) {
						var docE = _doc.documentElement, body = _doc.body;
						event.pageX = event.clientX + (docE && docE.scrollLeft || body && body.scrollLeft || 0) - (docE && docE.clientLeft || body && body.clientLeft || 0);
						event.pageY = event.clientY + (docE && docE.scrollTop  || body && body.scrollTop  || 0) - (docE && docE.clientTop  || body && body.clientTop  || 0);
					}
					fn.call(this, event);
				};
			},
			mouseEnter: function(fn) {
				var isAChildOf = function(parent, child) {
					if(parent === child) { return false; }
					while(child && child !== parent) { child = child.parentNode; }
					return child === parent;
				};
				return function mouseEnter(event) {
					var relTarget = event.relatedTarget;
					if(this === relTarget || isAChildOf(this, relTarget)) { return; }
					fn.call(this, event);
				};
			}
		};


	/** Vector Class **/
	var Vector = function(x, y, z) {
		this.set = function(x, y, z) {
			this.x = x || 0;
			this.y = y || 0;
			this.z = z || 0;
		};

		if(x !== undefined && isObject(x)) { this.set(x.x, x.y, x.z); }
		else { this.set(x, y, z); }

		this.Multiply = function(factor) {
			this.x *= factor;
			this.y *= factor;
			this.z *= factor;
			return this;
		};

		this.Done = function() {
			return Math.abs(this.x) > 0.01 || Math.abs(this.y) > 0.01 || Math.abs(this.z) > 0.01;
		};
	};



	/** Surface Class **/
	var Surface = function(width, height) {
		this.set = function(width, height) {
			this.width  = width  || 0;
			this.height = height || 0;
		};

		if(width !== undefined && isObject(width)) { this.set(width.width, width.height); }
		else { this.set(width, height); }
	};



	/** Mouse Attractor Class **/
	var Attractor = function(parent, id, className) {
		this.id = id;
		this.className = className;
		this.active = false;
		this.mouse = new Vector();
		this.position = new Vector();
		this.size = new Surface({
			width:  parent.size.width  || Defaults.Width  / 2,
			height: parent.size.height || Defaults.Heigth / 2
		});

		this.element = _doc.createElement("div");
		this.element.setAttribute("id", this.id);
		this.element.setAttribute("class", this.className);
		this.element.style.width = this.size.width + "px";
		this.element.style.height = this.size.height + "px";
		this.element.style.display = "block";

		this.Activate = function() {
			var self = this;
			Event.Add(this.element, "mousemove", function(event) {
				return function(event) {
					if(!parent.active) { parent.Animate(); }
					if(!(!!Defaults.HoverStop && !this.active)) {
						this.Update();
						this.mouse.set(
							((-event.pageY + this.position.y) * 2 / this.size.height + 1) * 1.8,
							(( event.pageX - this.position.x) * 2 / this.size.width  - 1) * 1.8
						);
					}
				} .call(self, event);
			});
			Event.Add(this.element, "mouseenter", function() {
				self.active = true;
			});
			Event.Add(this.element, "mouseleave", function() {
				self.active = false;
			});
			return this;
		};

		this.Update = function() {  // Attractor's position can be moved, so position needs to be updated;
			this.position = new Vector({
				x: this.element.offsetLeft,
				y: this.element.offsetTop
			});
			return this;
		};
	};



	/** Tag Class **/
	var Tag = function(title, rank, url) {
		this.id = _TagID++;
		this.title = title;
		this.rank = ((!isNaN(rank) && rank >= 0 && rank <= 100) ? rank : Defaults.Rank) / 100;
		this.url = url || (isNaN(rank) ? rank : false) || Defaults.Url;
		this.position = new Vector();

		var aa = _doc.createElement("a"),
			li = _doc.createElement("li");
		aa.setAttribute("id", "jsCumulus" + this.id);
		aa.setAttribute("href", this.url);
		aa.innerHTML = this.title;
		li.setAttribute("class", "tagClass");
		li.style.position = "absolute";
		li.appendChild(aa);
		this.element = li;

		this.Activate = function(attractor) {
			Event.Add(this.element, "mouseenter", function() {
				attractor.active = false;
			});
			Event.Add(this.element, "mouseleave", function() {
				attractor.active = true;
			});
			return this;
		};

		this.Update = function(delta, offset, fontMin, fontMax){
			delta = delta || new Vector();
			offset = offset || new Vector();

			var pos = this.position,
				deltA = delta.x || 0, deltB = delta.y || 0,
				sinA = Sine(deltA), cosA = Cosine(deltA),
				sinB = Sine(deltB), cosB = Cosine(deltB),
				xz = pos.y * sinA + pos.z * cosA,
				x = pos.x * cosB + xz * sinB,
				y = pos.y * cosA + pos.z * (-sinA),
				z = pos.x * (-sinB) + xz * cosB,
				per = Defaults.Depth / (Defaults.Depth + z),
				fontRange = fontMax - fontMin;

			pos.set(x, y, z);

			aa.style.opacity = Math.max(per - 0.7, 0) / 0.5 + 0.2;
			aa.style.fontSize = this.rank * per * fontRange + fontMin + "px";
			li.style.left = (offset.x + x * per) - (li.clientWidth / 2) + "px";
			li.style.top = (offset.y + y * per) - (li.clientHeight / 2) + "px";
			
			pos = deltA = deltB = sinA = cosA = sinB = cosB = xz = x = y = z = per = fontRange = null;
			
			return this;
		};
	};



	/** TagCloud Class **/
	var TagCloud = function(/* element, */tags, width, height, options) {
		if(isElement(arguments[0])) {
			this.element = arguments[0];
			tags = arguments[1];
			width = arguments[2];
			height = arguments[3];
			options = arguments[4];
		}

		options = options || isObject(height) && height || isObject(width) && width || {};

		this.fps = {
			timer: null,
			elm: null,
			i: 0
		};

		this.active = false;
		this.delta = new Vector(-2, -2);
		this.size = new Surface({
			width:  parseFloat(!!parseFloat(width)  && width  || !!parseFloat(options.width)  && options.width  || Defaults.Width),
			height: parseFloat(!!parseFloat(height) && height || !!parseFloat(options.height) && options.height || width || Defaults.Height)
		});
		this.font = {
			min: parseFloat(options.fontMin) || Defaults.FontMin,
			max: parseFloat(options.fontMax) || Defaults.FontMax
		};
		this.radius = options.radius || Math.min(this.size.width, this.size.height) / 4;
		this.consistent = options.consistent !== undefined ? !!options.consistent : Defaults.Consistent;
		this.overwrite  = options.overwrite  !== undefined ? !!options.overwrite  : Defaults.OverWrite;
		this.items = tags && tags.length && tags.slice(0) || (function() {  // slice(0) to clone the tags;
			var i = 50, ii = 0, tags = [];
			for(; i >= ii; --i) {
				tags[i] = new Tag("+", 100);
			}
			return tags;
		})();

		this.attractor = new Attractor(
			this,
			options.id || Defaults.ID + Math.floor(Math.random() * 10000 + 1),
			options.className || Defaults.Class
		);

		options = null;

		this.Distribute = function(element) {
			element = element || this.element || _doc.body;
			var container = _doc.createElement("ul"),
				i = this.items.length - 1, l = 0, item;
			if(this.overwrite) {
				while(element.firstChild) {
					element.removeChild(element.firstChild);
				}
			}
			for(; i >= l; --i) {
				item = this.items[i];
				if(item instanceof Tag && item.title) {  // only Tag class allowed with at least titles;
					container.appendChild(item.element);
					item.Activate(this.attractor);  // only activate after appended to DOM;
				} else {
					this.items.splice(i, 1);
				}
			}
			this.attractor.element.appendChild(container);
			element.appendChild(this.attractor.element);
			this.attractor.Activate();  // only activate after appended to DOM;

			container = i = l = null;

			var p = 0, t = 0,
				tags = this.items,
				ii = 0, ll = tags.length,
				radius = this.radius;
			for(; ii < ll; ii++) {
				p = this.consistent ? Math.acos(-1 + (2 * ii) / ll) : Math.random() * (Math.PI);
				t = this.consistent ? Math.sqrt(ll * Math.PI) * p : Math.random() * (2 * Math.PI);
				tags[ii].position.set(
					radius * Math.sin(p) * Math.cos(t),
					radius * Math.sin(p) * Math.sin(t),
					radius * Math.cos(p)
				);
			}

			p = t = tags = ii = ll = radius = null;

			this.fps.elm = _doc.getElementById(this.attractor.id + "_fps");

			this.Update();
			return this;
		};

		this.Update = function(delta) {
			this.fps.timer = new Date() * 1;

			delta = delta || new Vector();
			
			var attractor = this.attractor.Update(),
				i = 0, l = this.items.length;

			this.position = new Vector({
				x: this.size.width  / 2 + attractor.position.x,
				y: this.size.height / 2 + attractor.position.y
			});

			for(; i < l; i++) {
				this.items[i].Update(delta, this.position, this.font.min, this.font.max);
			}

			delta = attractor = i = l = null;

			if(this.fps.elm){ this.fps.elm.innerHTML = parseInt(++this.fps.i / ((new Date() * 1) - this.fps.timer), 10) + " fps"; }

			return this;
		};

		this.Pause = function() {
			if(this.animation) {
				this.active = false;
				_win.clearInterval(this.animation);
				this.animation = null;
				this.fps.timer = null;
				this.fps.i = 0;
				if(this.fps.elm){ this.fps.elm.innerHTML = "# fps"; }
			}
			return this;
		};

		this.Stop = function() {
			this.delta = new Vector();  // reset the delta to 0, 0;
			this.Pause();  // same effect;
			return this;
		};

		this.Animate = function(delta) {
			if(delta) { this.Stop(); }  // if delta exist a new animation is created and the old one should be stopped;
			this.active = true;
			this.delta = delta || this.delta || new Vector();
			var self = this;
			this.animation = _win.setInterval(function() {
				return function animation() {
					this.delta = this.attractor.active ? this.attractor.mouse : this.delta.Multiply((Math.min(Defaults.HoverStop, 99) / 10 + 90) / 100);
					if(this.delta.Done()) {
						this.Update(this.delta);
					} else {
						this.Stop();
					}
				} .call(self);
			}, Defaults.AnimationTime);
			return this;
		};

		if(this.element) {
			this.Distribute(this.element);
		}
	};

	_win.TagCloud = TagCloud;
	_win.Tag = Tag;
	_win.Vector = Vector;
	_win.Surface = Surface;

	_win.JSCumulus = {
		TagCloud: TagCloud,
		Tag: Tag,
		Vector: Vector,
		Surface: Surface,
		noConflict: function() {
			_win.TagCloud = _TagCloud;
			_win.Tag = _Tag;
			_win.Vector = _Vector;
			_win.Surface = _Surface;

			return {
				TagCloud: TagCloud,
				Tag: Tag,
				Vector: Vector,
				Surface: Surface
			};
		}
	};

})(window, window.document);