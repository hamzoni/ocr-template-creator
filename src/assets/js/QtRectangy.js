export class QtRectangy {
    constructor(container) {
        this.mnu = new Maneuver(this);

        this.omc = new ObjectModelContainer(container);
        this.cube = new Cube(this);

        // re-positioning mode
        this.strategy = {
            p: new PositioningStrategy(this),
            d: new DrawingROIStrategy(),
        };

        // options
        this.opt = new OptionMenu();
    }

    load() {
        this.mnu.create($('[moveable]'));
        this.mnu.load();
    }
}

class OptionMenu {
    constructor() {
        this.reset();
    }

    mode(mode) {
        this.p = mode === 'DRAGGING';
        this.d = mode === 'DRAWING';

        // set default option
        if (!mode) this.reset();
    }

    reset() {
        this.p = false;
        this.d = true;
    }
}

class Maneuver {
    constructor(master) {
        this.master = master;
        this.mouse = new MouseRecorder();
        this.target = null;
        this.dist = [];

    }

    create(host) {
        let vm = this;
        // there are two types: cropper box and resizing cubes
        let boxes = host.filter('[box]');
        let cubes = host.filter('[cube]');
        let canvas = host.filter('[canvas]');

        canvas.each(function () {
            $(this).mousedown(e => {

                vm.master.mnu.target = $(e.target);
                vm.master.mnu.mouse.lx = e.pageX;
                vm.master.mnu.mouse.ly = e.pageY;

                // vm.master.omc.container.find('*').removeClass('active');
            });
        });

        boxes.each(function (index) {
            $(this).mousedown(e => {
                e.stopPropagation();
                vm.master.mnu.target = $(e.target);
                vm.master.mnu.mouse.lx = e.pageX;
                vm.master.mnu.mouse.ly = e.pageY;

                // if boxes selected elevated index level of itself and so does its satellite cubes
                vm.master.omc.container.find('*').removeClass('active');
                vm.master.cube.attach($(e.target));
                if (vm.master.opt.p) {
                    $(this).addClass('active');
                    $.each(vm.master.cube.cubes, function () {
                        this.entity.addClass('active');
                    });
                }

            });

        });

        cubes.each(function (index) {
            $(this).mousedown(e => {
                vm.master.mnu.target = $(this);
                vm.master.mnu.mouse.lx = e.pageX;
                vm.master.mnu.mouse.ly = e.pageY;
            });
        });
    }

    // load for first time
    load() {
        let vm = this;
        $('html').mousedown(function (e) {
            vm.mouse.down = true;
            vm.mouse.lx = e.pageX;
            vm.mouse.ly = e.pageY;
            if (vm.master.opt.p) {
                vm.master.strategy.p.register(vm, e)
            } else if (vm.master.opt.d) {
                vm.master.strategy.d.register(vm, e)
            }

        }).mousemove(function (e) {
            vm.mouse.x = e.pageX;
            vm.mouse.y = e.pageY;
            if (vm.master.opt.p) {
                vm.master.strategy.p.action(vm, e);
            } else {
                vm.master.strategy.d.action(vm, e)
            }

        }).mouseup(function (e) {
            // reset everything
            vm.closeEvent();
        });

        $('document').mouseup(this.closeEvent);
        $(window).on('blur', this.closeEvent);
        $(document).on('blur', this.closeEvent);

    }

    closeEvent() {
        if (this.mouse) {
            this.mouse.down = false;
            this.mouse.recur();
        } else {
            this.mouse = new MouseRecorder();
        }

        this.target = null;

        if (this.master) {
            this.master.strategy.p.cubesGroup = [];
            this.master.strategy.p.cubeAudit = null;

            this.master.strategy.d.target = null;
        }
    }

}

class DrawingROIStrategy {
    constructor() {
        this.target = null;

        this.sp = {};
        this.ep = {};
    }

    register(vm, e) {
        this.target = $('<div/>');
        this.target.addClass('active');

        this.target.attr('box', '');
        this.target.attr('resizeable', '');
        this.target.attr('moveable', '');
        this.target.addClass('image');

        vm.master.omc.container.append(this.target);
        vm.master.load();

        this.sp = {
            x: e.pageX,
            y: e.pageY
        };
    }

    action(vm, e) {
        if (!this.target) return;

        this.ep = {
            x: e.pageX,
            y: e.pageY
        };

        let w = this.ep.x - this.sp.x;
        let h = this.ep.y - this.sp.y;

        this.target.css({
            width: w,
            height: h,
            left: this.sp.x,
            top: this.sp.y
        });

    }
}

class PositioningStrategy {
    constructor(vm) {
        this.master = vm;

        this.cubeAudit = null;

        // correlated cubes which move relative to one another
        this.corr = [];
    }

    register(vm, e) {

        let cubesGroup = this.master.cube.cubes;

        // record distance of mouse and object in first location
        if (!vm.target) return;

        // calculate original position for box
        let hpos = vm.target.position();
        vm.dist[0] = e.pageX - hpos.left;
        vm.dist[1] = e.pageY - hpos.top;

        // move along with cubes
        // reposition cubes
        if (vm.target[0].hasAttribute('box')) {

            if (vm.target[0].hasAttribute('resizeable')) {
                vm.master.cube.cubes.forEach(cube => {
                    let hpos = cube.entity.position();
                    cube.dist[0] = e.pageX - hpos.left;
                    cube.dist[1] = e.pageY - hpos.top;
                });
            }

        } else if (vm.target[0].hasAttribute('cube')) {


            let entityId = $('[cube]').index(vm.target);
            this.cubeAudit = cubesGroup[entityId];

            // calculate original position for cube
            let hpos = vm.target.position();
            this.cubeAudit.dist[0] = e.pageX - hpos.left;
            this.cubeAudit.dist[1] = e.pageY - hpos.top;

            // calculated original position for correlated cubes
            this.corr = this.findCorrelatedCubes(vm);

            let hposcx = this.corr.x.entity.position();
            this.corr.x.dist[0] = e.pageX - hposcx.left;
            this.corr.x.dist[1] = e.pageY - hposcx.top;

            let hposcy = this.corr.y.entity.position();
            this.corr.y.dist[0] = e.pageX - hposcy.left;
            this.corr.y.dist[1] = e.pageY - hposcy.top;
        }
    }

    action(vm, e) {

        e.stopPropagation();
        if (!vm.target) return;

        let cubesGroup = this.master.cube.cubes;

        // move size
        let msx = e.pageX - vm.dist[0];
        let msy = e.pageY - vm.dist[1];

        // check moving target is box
        if (vm.target[0].hasAttribute('box')) {

            // move cubes along with box
            vm.master.cube.cubes.forEach(cube => {
                cube.entity.css({
                    left: e.pageX - cube.dist[0],
                    top: e.pageY - cube.dist[1]
                });
            });

        } else if (vm.target[0].hasAttribute('cube')) {

            // moving correlated x partner and y partner cube
            /*
            Idea:
            - correlated X will change Y if target Y changed
            - correlated Y will change X if target X changed
             */

            if (this.corr.y.entity) {
                this.corr.y.entity.css({
                    top: e.pageY - this.corr.y.dist[1]
                });
            }

            if (this.corr.x.entity) {
                this.corr.x.entity.css({
                    left: e.pageX - this.corr.x.dist[0],
                });
            }
        }

        // subtract first relative distance record to keep linear motion
        vm.target.css({
            left: msx,
            top: msy
        });

        // calculate size of new rectangle and its position
        if (vm.target[0].hasAttribute('cube')) {

            // locate root point and width and height of new rectangle
            let cdx = cubesGroup.map(audit => audit.entity.position().left);
            let cdy = cubesGroup.map(audit => audit.entity.position().top);

            let minc = {
                x: Math.min.apply(null, cdx),
                y: Math.min.apply(null, cdy),
            };

            let maxc = {
                x: Math.max.apply(null, cdx),
                y: Math.max.apply(null, cdy),
            };

            // find root point TL
            let rp = cubesGroup.filter(audit => {
                return audit.entity.position().left === minc.x &&
                    audit.entity.position().top === minc.y
            })[0];

            // calculate new width and height
            let nw = maxc.x - minc.x;
            let nh = maxc.y - minc.y;
            let npc = rp.entity.position();

            // update size and position of box
            this.cubeAudit.host.css({
                width: nw,
                height: nh,
                left: npc.left + vm.target.width() / 2,
                top: npc.top + vm.target.height() / 2,
            });

        }

    }

    findCorrelatedCubes(vm) {
        let corrX, corrY;
        let cubes = this.master.cube.cubes;

        for (let i = 0; i < cubes.length; i++) {

            let item = cubes[i].entity;

            if (item.attr('cube') === vm.target.attr('cube')) continue;

            if (!corrX && item.position().left === vm.target.position().left)
                corrX = cubes[i];

            if (!corrY && item.position().top === vm.target.position().top)
                corrY = cubes[i];
        }

        return {
            x: corrX,
            y: corrY
        }
    }
}

class MouseRecorder {
    constructor() {
        this.down = false;
        this.x = 0;
        this.y = 0;
    }

    recur() {
        this.lx = this.x;
        this.ly = this.y;
    }
}

class Cube {
    constructor(master) {
        this.master = master;
        this.size = {
            w: 30, h: 30
        };

        // create 4 cubes
        this.cubes = Array.from(Array(4), ((_, i) => {
            let cube = this.makeOne(i);
            this.master.omc.container.append(cube);
            return new CubeAudit(i, cube);
        }));
    }

    attach(host) {

        let hpos = host.position();
        let hw = host.width();
        let hh = host.height();
        let ht = hpos.top;
        let hl = hpos.left;

        let cubePositions = [
            [ht, hl],
            [ht, hl + hw],
            [ht + hh, hl + hw],
            [ht + hh, hl],
        ];

        cubePositions.forEach((cp, i) => {
            let cube = this.cubes[i];
            cube.host = host;
            this.placing(cube.entity, cp);
        });

    }

    // create single cube
    makeOne(cubeId) {
        let cube = $("<div>");
        cube.addClass('cube');

        // attach cube to four corners of host
        cube.css({
            width: this.size.w,
            height: this.size.h
        });

        // attach event of cube
        cube.attr('moveable', '');
        cube.attr('cube', cubeId);

        return cube;
    }

    placing(cube, cp) {
        let cox = this.size.w / 2;
        let coy = this.size.h / 2;

        cube.css({
            top: cp[0] - cox,
            left: cp[1] - coy,
        });
    }
}

class CubeAudit {
    constructor(id, entity) {
        this.id = id;

        // contain actual cube
        this.entity = entity;

        // host that cubes are attached to
        this.host = null;

        this.dist = [];
    }
}


class ObjectModelContainer {
    constructor(container) {
        this.container = container;
    }
}
