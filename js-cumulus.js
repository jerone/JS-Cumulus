/*\
JS-Cumulus - JavaScript Cumulus Plugin (codenamed jscumulus)
Based on Stratus plugin by Dawid Fatyga (fatyga@student.agh.edu.pl)
Based on WP-Cumulus plugin by Roy Tanck (http://www.roytanck.com)

@author Jeroen van Warmerdam (aka jerone or jeronevw) (http://www.jeroenvanwarmerdam.nl)
@date 18.01.2010 00:15:00
@version 0.1

Copyright 2010, Jeroen van Warmerdam

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <http://www.gnu.org/licenses/>.
\*/

/*\
TODO:
IDEA: Mouse panning, zooming;
ADD: Documentation;
ADD: Z-sorting;
ADD: slow down more on tag mouse focus;
ADD: Calculating the color instead using the Opacity property;
FIX: Customizable styles for Tags disables the default hilight Color;
\*/

/*\
TagCloud:
element	=> Element			=> Element to append TagCloud;
tags	=> Array [Tag,...]	=> List of tags;
width	=> Float			=> Width of container (optional)(default: 400);
height	=> Float			=> Height of container (optional)(default: same as width);
options	=> Object			=> Extra settings (optional);
id			=> String		=> Id of the wrapper (optional)(default: "tagCloud1234");
className	=> String		=> Class of the wrapper (optional)(default: "tagCloud");
uniform		=> Boolean		=> Devide tags evenly (optional)(default: true);
radius		=> Float		=> Radius (optional)(default: Math.min(width, height) / 4);
fontMin		=> Float		=> Font size for smallest tag in pixels (optional)(default: 10);
fontMax		=> Float		=> Font size for biggest tag in pixels (optional)(default: 24);
		
Tag:
title	=> String			=> Title of the tag;
rank	=> Integer 0-100	=> Importance of the tag (optional)(default: 30);
url		=> String			=> Link of the tag (optional)(default "#");
\*/

(function(_window, undefined) {

	/* Defaults */
	var Defaults = {
		ID: "tagCloud", 		// Tagcloud id;
		Class: "tagCloud", 		// Tagcloud class;
		Width: 400, 			// Tagcloud width in pixels;
		Heigth: 400, 			// Tagcloud height in pixels;
		Uniform: true, 			// Devide tags evenly;
		Rank: 30, 				// Tag importance in procents;
		Url: "#", 				// Tag url;
		FontMin: 10, 			// Font size for smallest tag in pixels;
		FontMax: 24, 			// Font size for biggest tag in pixels;
		Depth: 150, 			// Perspective depth;
		AnimationTime: 1, 		// Animation time and interval, the less it is the faster the animation is;
		HoverStop: true			// Stop animation when tag is hovered;
	};

	/* Variables */
	var _win = _window,
		_doc = _win.document,
		_TagCloud = _win.TagCloud,
		_Tag = _win.Tag,
		_Vector = _win.Vector,
		_Surface = _win.Surface,
		_obj = Object.prototype.toString,
		_objObj = "[object Object]",
		isObject = function(arg) { return _obj.call(arg) === _objObj; },
		Radian = Math.PI / 180,
		sine = [], cosine = [],
		Sine = (function() {
			var i = 0, total = 3600;
			while(i < total) {
				sine[i] = Math.sin(i / 10 * Radian);
				i++;
			}
			return function Sine(angle) {
				while(angle < 0) { angle += 360; }
				return sine[Math.round(angle * 10) % total];
			};
		})(),
		Cosine = (function() {
			var i = 0, total = 3600;
			while(i < total) {
				cosine[i] = Math.cos(i / 10 * Radian);
				i++;
			}
			return function(angle) { return cosine[Math.round(Math.abs(angle) * 10) % total]; };
		})(),
		Event = {
			Add: (function() {
				if(_doc.addEventListener) {
					return function(obj, type, fn) {
						fn = Event.Fix.call(this, type === "mouseenter" || type === "mouseleave" ? Event.mouseEnter(fn) : fn);
						type = type === "mouseenter" && "mouseover" || type === "mouseleave" && "mouseout" || type;
						obj.addEventListener(type, fn, false);
						return function() {
							obj.removeEventListener(type, fn, false);
							return true;
						};
					};
				} else if(_doc.attachEvent) {
					return function(obj, type, fn) {
						fn = Event.Fix.call(this, fn);
						obj.attachEvent("on" + type, fn);
						return function() {
							obj.detachEvent("on" + type, fn);
							return true;
						};
					};
				}
			})(),
			Fix: function(fn) {
				return function(event) {
					if(!event.target) { event.target = event.srcElement || _doc; }
					if(event.target.nodeType === 3) { event.target = event.target.parentNode; }
					if(!event.relatedTarget && event.fromElement) { event.relatedTarget = event.fromElement === event.target ? event.toElement : event.fromElement; }
					if(event.pageX == null && event.clientX != null) {
						var docE = _doc.documentElement, body = _doc.body;
						event.pageX = event.clientX + (docE && docE.scrollLeft || body && body.scrollLeft || 0) - (docE && docE.clientLeft || body && body.clientLeft || 0);
						event.pageY = event.clientY + (docE && docE.scrollTop || body && body.scrollTop || 0) - (docE && docE.clientTop || body && body.clientTop || 0);
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
				return function(event) {
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
			this.width = width || 0;
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
			width: parent.size.width || Defaults.Width / 2,
			height: parent.size.height || Defaults.Heigth / 2
		});

		this.element = _doc.createElement("div");
		this.element.setAttribute("id", this.id);
		this.element.setAttribute("class", this.className);
		this.element.style.width = this.size.width + "px";
		this.element.style.height = this.size.height + "px";
		this.element.style.display = "block";

		this.Activate = function() {
			this.position = new Vector({
				x: this.element.offsetLeft,
				y: this.element.offsetTop
			});

			var self = this;
			Event.Add(this.element, "mousemove", function(event) {
				return function(event) {
					if(!parent.active) { parent.Animate(); }
					if(!(Defaults.HoverStop && !this.active)) {
						this.mouse.set(
							((-event.pageY + this.position.y) * 2 / this.size.height + 1) * 1.8,
							((event.pageX - this.position.x) * 2 / this.size.width - 1) * 1.8
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
		};
	};



	var __TagId = 0;
	function getTagId() {
		__TagId += 1;
		return __TagId;
	}

	/** Tag Class **/
	var Tag = function(title, rank, url) {
		this.id = getTagId();
		this.title = title;
		this.rank = ((!isNaN(rank) && rank >= 0 && rank <= 100) ? rank : Defaults.Rank) / 100;
		this.url = url || (isNaN(rank) ? rank : false) || Defaults.Url;
		this.position = new Vector();

		var li = _doc.createElement("li"),
			aa = _doc.createElement("a");
		aa.setAttribute("id", "jsCumulus" + this.id);
		aa.setAttribute("href", this.url);
		aa.innerHTML = this.title;
		li.setAttribute("class", "tagClass");
		li.style.position = "absolute";
		li.appendChild(aa);
		this.element = li;
		li = aa = null;  // clean up memory leak;

		this.Activate = function(attractor) {
			Event.Add(this.element, "mouseenter", function() {
				attractor.active = false;
			});
			Event.Add(this.element, "mouseleave", function() {
				attractor.active = true;
			});
		};
	};



	/** TagCloud Class **/
	var TagCloud = function(element, tags, width, height, options) {
		if(!element) { throw "[TagCloud] No element!"; }

		var options = options || isObject(arguments[3]) && arguments[3] || isObject(arguments[2]) && arguments[2] || {},
			container = _doc.createElement("ul");

		this.active = false;
		this.delta = new Vector(-2, -2);
		this.size = new Surface({
			width: parseFloat(!!parseFloat(width) && width || !!parseFloat(options.width) && options.width || Defaults.Width),
			height: parseFloat(!!parseFloat(height) && height || !!parseFloat(options.height) && options.height || width || Defaults.Height)
		});
		this.font = {
			min: parseFloat(options.fontMin) || Defaults.FontMin,
			max: parseFloat(options.fontMax) || Defaults.FontMax
		};
		this.radius = options.radius || Math.min(this.size.width, this.size.height) / 4;
		this.uniform = options.uniform !== undefined ? !!options.uniform : Defaults.Uniform;
		this.items = tags && tags.length && tags.slice(0) || (function() {  // used slice(0) to clone the tags;
			var i = 50, ii = 0, tags = [];
			for(; i >= ii; --i) {
				tags[i] = new Tag(".", 100);
			}
			return tags;
		})();

		this.attractor = new Attractor(
			this,
			options.id || Defaults.ID + Math.floor(Math.random() * 10000 + 1),
			options.className || Defaults.Class
		);

		var i = this.items.length - 1, ii = 0, item;
		for(; i >= ii; --i) {
			item = this.items[i];
			if(item instanceof Tag && item.title) {  // only Tag class with at least titles allowed;
				container.appendChild(item.element);
				item.Activate(this.attractor);  // only activate after appended to DOM;
			} else {
				this.items.splice(i, 1);
			}
		}
		this.attractor.element.appendChild(container);
		element.appendChild(this.attractor.element);
		this.attractor.Activate();  // only activate after appended to DOM;

		this.position = new Vector({  // only calculate tagcloud position with attractor position after it's appended to DOM;
			x: this.size.width / 2 + this.attractor.position.x,
			y: this.size.height / 2 + this.attractor.position.y
		});

		options = container = null;  // clean up memory leak;

		this.Distribute = function() {
			var p = 0, t = 0, i = 0,
				tags = this.items,
				count = tags.length - 1,
				radius = this.radius;
			while(i <= count) {
				if(this.uniform) {
					p = Math.acos(-1 + (2 * i) / count);
					t = Math.sqrt(count * Math.PI) * p;
				} else {
					p = Math.random() * (Math.PI);
					t = Math.random() * (2 * Math.PI);
				}
				tags[++i].position.set(
					radius * Math.sin(p) * Math.cos(t),
					radius * Math.sin(p) * Math.sin(t),
					radius * Math.cos(p)
				);
			}
			this.Update();
		};

		this.Update = function(delta) {
			var delta = delta || new Vector(),
				tags = this.items,
				deltA = delta.x || 0, deltB = delta.y || 0,
				sinA = Sine(deltA), cosA = Cosine(deltA),
				sinB = Sine(deltB), cosB = Cosine(deltB),
				fontRange = this.font.max - this.font.min,
				i = 0, l = tags.length;
			for(; i < l; i++) {
				var tag = tags[i],
					pos = tag.position,
					li = tag.element,
					aa = li.firstChild,
					x = pos.x * cosB + (pos.y * sinA + pos.z * cosA) * sinB,
					y = pos.y * cosA + pos.z * (-sinA),
					z = pos.x * (-sinB) + (pos.y * sinA + pos.z * cosA) * cosB,
					per = Defaults.Depth / (Defaults.Depth + z);
				pos.set(x, y, z);
				aa.style.opacity = Math.max(per - 0.7, 0) / 0.5 + 0.2;
				aa.style.fontSize = tag.rank * per * fontRange + this.font.min + "px";
				li.style.left = (this.position.x + x * per) - (li.clientWidth / 2) + "px";
				li.style.top = (this.position.y + y * per) - (li.clientHeight / 2) + "px";
			}
		};

		this.Pause = function() {
			if(this.animation) {
				this.active = false;
				_win.clearInterval(this.animation);
				this.animation = null;  // clean up memory leak;
			}
		};

		this.Stop = function() {
			this.delta = new Vector();  // reset the delta to 0, 0;
			if(this.animation) {
				this.active = false;
				_win.clearInterval(this.animation);
				this.animation = null;  // clean up memory leak;
			}
		};

		this.Animate = function(delta) {
			this.active = true;
			this.delta = delta || this.delta || new Vector();
			var self = this;
			this.animation = _win.setInterval(function() {
				return function() {
					if(this.attractor.active) {
						this.delta = this.attractor.mouse;
					} else {
						this.delta = this.delta.Multiply(0.98);
					}
					if(this.delta.Done()) {
						this.Update(this.delta);
					} else {
						this.Stop();
					}
				} .call(self);
			}, Defaults.AnimationTime);
		};

		this.Distribute();
	};

	_win.JSCumulus = JSCumulus = {};
	_win.TagCloud = TagCloud;
	_win.Tag = Tag;
	_win.Vector = Vector;
	_win.Surface = Surface;

	JSCumulus.noConflict = function() {
		_win.TagCloud = _TagCloud;
		_win.JSCumulus.TagCloud = TagCloud;
		_win.Tag = _Tag;
		_win.JSCumulus.Tag = Tag;
		_win.Vector = _Vector;
		_win.JSCumulus.Vector = Vector;
		_win.Surface = _Surface;
		_win.JSCumulus.Surface = Surface;
	};

})(window);