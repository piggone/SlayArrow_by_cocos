import GameUtils from "../Utils/GameUtils"
import MathUtils from "../Utils/MathUtils"
import { SingleBase } from "../Utils/SingleBase";

export class TimerHandler {
	/** 执行间隔 */
	public delay: number = 0;
	/** 是否重复执行 */
	public forever: boolean = false;
	/** 重复执行次数 */
	public repeatCount: number = 0;
	/** 执行时间 */
	public exeTime: number = 0;
	/** 处理函数 */
	public method: Function;
	/** 处理函数所属对象 */
	public methodObj: any;
	/** 处理函数的参数(以数组形式储存) */
	public methodArgs: Array<any>;

	/** 完成处理函数 */
	public onFinish: Function;
	/**完成处理函数所属对象*/
	public finishObj: any;

	/**清理*/
	public clear(): void {
		this.method = null;
		this.methodObj = null;
		this.methodArgs = null;
		this.onFinish = null;
		this.finishObj = null;
		this.forever = false;
	}
}

export default class TimerManager extends SingleBase{

	private _handlers: TimerHandler[];
	private _currTime: number;
	private _currFrame: number;
	private currHandler: TimerHandler;
    private nexthandles: TimerHandler[];
    protected _HandlerPool: TimerHandler[];
	protected _Timer: cc.Scheduler;

	constructor() {
		super();
		
		this._handlers = [];
        this.nexthandles = null;
        this._HandlerPool = [];

		this._currTime = 0;
		this._currFrame = 0;
		this._Timer = cc.director.getScheduler();
		// 为target注册一个uuId, 不然引擎内部会爆红
		this._Timer.enableForTarget(this);
		this._Timer.schedule(this.update, this, -1); // Timer类的update将会优于所有组件内的update
	}

	public getFrameId(): number {
		return this._currFrame;
	}

	public getCurrTime(): number {
		return this._currTime;
	}

	// 从大到小排序
	public static binFunc(b1: TimerHandler, b2: TimerHandler): number {
		if (b1.exeTime > b2.exeTime) return -1;
		else if (b1.exeTime < b2.exeTime) return 1;
		else return 0;
	}

	private _DeleteHandle(handler: TimerHandler) {
		handler.clear();
		this._HandlerPool.push(handler);
	}

	/**
	 * 每帧执行函数
	 * @param frameTime
	 */
	private update(time: number): boolean {
        this._currFrame++;
		this._currTime = GameUtils.GetTime();
		let currTime: number = 0;
		let nexthandles = this.nexthandles;
		this.nexthandles = null;
		if (nexthandles && nexthandles.length > 0) {
			for (let handler of nexthandles) {
				handler.method.apply(handler.methodObj, handler.methodArgs);
				this._DeleteHandle(handler);
			}
			nexthandles = null;
		}

		if (this._handlers.length <= 0) return false;

		let handler = this._handlers[this._handlers.length - 1];
		while (handler.exeTime <= this._currTime) {
			this.currHandler = handler = this._handlers.pop();
			handler.method.apply(handler.methodObj,handler.methodArgs);
			currTime = GameUtils.GetTime();
			handler.exeTime = currTime + handler.delay;

			let repeat: boolean = handler.forever;
			if (!repeat) {
				if (handler.repeatCount > 1) {
					handler.repeatCount--;
					repeat = true;
				} else {
					if (handler.onFinish)
						handler.onFinish.apply(handler.finishObj);
				}
			}

			if (repeat) {
				let index = MathUtils.binSearch(this._handlers, handler, TimerManager.binFunc);
				this._handlers.splice(index, 0, handler);
			} else 
				this._DeleteHandle(handler);

			if(currTime - this._currTime > 5) break;

			if (this._handlers.length <= 0) break;
			else handler = this._handlers[this._handlers.length - 1];
		}
		this.currHandler = null;

		return false;
	}

	private create(startTime: number, delay: number, repeat: number, method: Function, methodObj: any, methodArgs: Array<any> = [],
				   onFinish: Function, fobj: any): void {
		if (delay < 0 || repeat < 0 || method == null) {
			return;
		}

		let handler: TimerHandler = this._HandlerPool.pop() || new TimerHandler();
		handler.forever = repeat == 0;
		handler.repeatCount = repeat;
		handler.delay = delay;
		handler.method = method;
		handler.methodObj = methodObj;
		handler.methodArgs = methodArgs;
		handler.onFinish = onFinish;
		handler.finishObj = fobj;
		handler.exeTime = startTime + delay;

		let index = MathUtils.binSearch(this._handlers, handler, TimerManager.binFunc);
		this._handlers.splice(index, 0, handler);
	}

	/**
	 *
	 * 定时执行
	 * @param delay 执行间隔:毫秒
	 * @param repeat 执行次数, 0为无限次
	 * @param method 执行函数
	 * @param methodObj 执行函数所属对象
	 * @param methodArgs 函数参数
	 * @param onFinish 完成执行函数
	 * @param fobj 完成执行函数所属对象
	 * @param remove 是否删除已经存在的
	 *
	 */
	public doTimer(delay: number, repeat: number, method: Function, methodObj: any
		, methodArgs: any = [] ,onFinish: Function = null, fobj: any = null): void {
		this.create(GameUtils.GetTime(), delay, repeat, method, methodObj, methodArgs, onFinish, fobj);
	}

	/**
	 *
	 * 定时执行
	 * @param startTime 延迟多久第一次执行
	 * @param delay 执行间隔:毫秒
	 * @param repeat 执行次数, 0为无限次
	 * @param method 执行函数
	 * @param methodObj 执行函数所属对象
	 * @param methodArgs 执行函数参数
	 * @param onFinish 完成执行函数
	 * @param fobj 完成执行函数所属对象
	 * @param remove 是否删除已经存在的
	 *
	 */
	public doTimerDelay(startTime: number, delay: number, repeat: number, method: Function, methodObj: any
		, methodArgs: any = [], onFinish: Function = null, fobj: any = null): void {
		this.create(startTime, delay, repeat, method, methodObj,methodArgs, onFinish, fobj);
	}

	// 下一帧执行，且只执行一次
	public doNext(method: Function, methodObj: any, args: Array<any> = []) {
		let handler: TimerHandler = this._HandlerPool.pop() || new TimerHandler();
		handler.method = method;
		handler.methodObj = methodObj;
		handler.methodArgs = args;

		if (!this.nexthandles)
			this.nexthandles = [];
		this.nexthandles.push(handler);
	}

	/**
	 * 清理
	 * @param method 要移除的函数
	 * @param methodObj 要移除的函数对应的对象
	 */
	public remove(method: Function, methodObj: any): void {
		let currHandler = this.currHandler;
		if (currHandler && currHandler.method == method &&
			currHandler.methodObj == methodObj) {
			currHandler.forever = false;
			currHandler.repeatCount = 0;
		}

		for (let i = this._handlers.length - 1; i >= 0; i--) {
			let handler = this._handlers[i];
			if (handler.method == method && handler.methodObj == methodObj) {
				this._handlers.splice(i, 1);
				this._DeleteHandle(handler);
			}
		}
	}

	/**
	 * 清理
	 * @param methodObj 要移除的函数对应的对象
	 */
	public removeAll(methodObj: any): void {
		let currHandler = this.currHandler;
		if (currHandler && currHandler.methodObj == methodObj) {
			currHandler.forever = false;
			currHandler.repeatCount = 0;
		}

		for (let i = this._handlers.length - 1; i >= 0; i--) {
			let handler = this._handlers[i];
			if (handler.methodObj == methodObj) {
				this._handlers.splice(i, 1);
				this._DeleteHandle(handler);
			}
		}
	}

	/**
	 * 检测是否已经存在
	 * @param method
	 * @param methodObj
	 */
	public isExists(method: Function, methodObj: any): boolean {
		for (let handler of this._handlers) {
			if (handler.method == method && handler.methodObj == methodObj) {
				return true;
			}
		}
		return false;
	}
}
