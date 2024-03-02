import { render } from 'react-dom'
import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import React from 'react'

import './css/style.css'

const App = () => {
    const video_cam = useRef<HTMLVideoElement>(null)
    const video_display = useRef<HTMLVideoElement>(null)
    const video_loop = useRef<HTMLVideoElement>(null)

    const output_canvas = useRef<HTMLCanvasElement>(null)
    const [ctx, set_ctx] = useState<CanvasRenderingContext2D>()

    const [cam_stream, set_cam_stream] = useState<MediaStream>()
    const [display_stream, set_display_stream] = useState<MediaStream>()

    const [selected_source, set_selected_source] = useState<'cam' | 'display' | 'loop'>()

    const [playing, set_playing] = useState(false)
    const [recording, set_recording] = useState(false)

    const [loop_src, set_loop_src] = useState<string>()
    const [loop_rate, set_loop_rate] = useState(1)

    const animate_ref = useRef<number>()

    const resize_video = useCallback((w_video: number, h_video: number) => {
        if (!output_canvas.current) return

        const w_canvas = output_canvas.current.width
        const h_canvas = output_canvas.current.height

        const r_video = w_video / h_video
        const r_canvas = w_canvas / h_canvas

        let new_w = w_video
        let new_h = h_video

        if (r_video > r_canvas) {
            new_w = w_canvas
            new_h = w_canvas * (h_video / w_video)
        } else {
            new_w = h_canvas * (w_video / h_video)
            new_h = h_canvas
        }

        return [new_w, new_h]

    }, [output_canvas])

    useEffect(() => {
        // set video source for cam streaming
        if (!video_cam.current || !cam_stream) return

        video_cam.current.srcObject = cam_stream
        video_cam.current.play()

    }, [video_cam, cam_stream])

    useEffect(() => {
        // set video source for display streaming
        if (!video_display.current || !display_stream) return

        video_display.current.srcObject = display_stream
        video_display.current.play()

    }, [video_display, display_stream])

    const select_display_media = useCallback(() => {
        if (display_stream) {
            set_selected_source('display')
            set_playing(true)

            return
        }

        navigator.mediaDevices.getDisplayMedia({
            video: {
                displaySurface: ['browser', 'monitor', 'window']
            },
            audio: false
        }).then((media_stream) => {
            set_display_stream(media_stream)
            set_selected_source('display')
            set_playing(true)

        })

    }, [display_stream])

    const select_camera_media = useCallback(() => {
        if (cam_stream) {
            set_selected_source('cam')
            set_playing(true)

            return
        }

        navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false
        }).then((media_stream) => {
            set_cam_stream(media_stream)
            set_selected_source('cam')
            set_playing(true)

        })

    }, [cam_stream])

    const select_loop = useCallback(() => {
        set_selected_source('loop')
        set_playing(true)
    }, [])

    useEffect(() => {
        animate_ref.current = requestAnimationFrame(animate)

        return () => {
            cancelAnimationFrame(animate_ref.current)
        }

    }, [playing, output_canvas, ctx, selected_source, video_display, video_cam])

    const animate = useCallback(() => {
        if (!ctx || !output_canvas.current || !video_cam.current || !video_display.current || !playing) {
            animate_ref.current = requestAnimationFrame(animate)
            return
        }

        ctx.clearRect(0, 0, output_canvas.current.width, output_canvas.current.height)

        switch (selected_source) {
            case 'cam':

                ctx.drawImage(
                    video_cam.current,
                    (output_canvas.current.width - video_cam.current.width) / 2,
                    (output_canvas.current.height - video_cam.current.height) / 2,
                    video_cam.current.width,
                    video_cam.current.height
                )
                break
            case 'display':
                ctx.drawImage(
                    video_display.current,
                    (output_canvas.current.width - video_display.current.width) / 2,
                    (output_canvas.current.height - video_display.current.height) / 2,
                    video_display.current.width,
                    video_display.current.height
                )
                break
            case 'loop':
                ctx.drawImage(
                    video_loop.current,
                    (output_canvas.current.width - video_loop.current.width) / 2,
                    (output_canvas.current.height - video_loop.current.height) / 2,
                    video_loop.current.width,
                    video_loop.current.height
                )
                break
        }

        animate_ref.current = requestAnimationFrame(animate)

    }, [
        playing,
        output_canvas, ctx,
        selected_source,
        video_display, video_cam, video_loop
    ])

    useEffect(() => {
        if (!output_canvas.current) return

        output_canvas.current.width = screen.width
        output_canvas.current.height = screen.height
        set_ctx(output_canvas.current.getContext('2d'))

    }, [output_canvas])

    useEffect(() => {
        if (!video_loop.current) return

        video_loop.current.src = loop_src
        video_loop.current.play().then(() => {
            video_loop.current.playbackRate = loop_rate
        })

    }, [loop_src, video_loop, loop_rate])

    useEffect(() => {
        if (!video_loop.current) return

        video_loop.current.playbackRate = loop_rate

    }, [video_loop, loop_rate])

    useEffect(() => {
        if (!output_canvas.current || !recording) return

        const output_stream = output_canvas.current.captureStream(30)

        const options = {
            mimeType: 'video/webm; codecs=vp9',
            videoBitsPerSecond: 10 * 1024 * 1024
        }

        if (!MediaRecorder.isTypeSupported(options.mimeType)) {
            options.mimeType = 'video/webm;'
        }

        const recorder = new MediaRecorder(output_stream, options)
        let chunks: Blob[] = []

        recorder.ondataavailable = (e) => {
            chunks.push(e.data)
        }

        recorder.onstop = () => {
            const loop_blob = new Blob(chunks, { type: 'video/webm;codecs=vp9' })

            const loop_blob_url = URL.createObjectURL(loop_blob)
            set_loop_src(loop_blob_url)
        }

        recorder.start()

        return () => {
            recorder.stop()
        }
    }, [output_canvas, recording])

    const key_binding: { [name: string]: () => void } = useMemo(() => {
        return {
            a: select_display_media,
            s: select_camera_media,
            d: select_loop,
            ' ': () => set_playing(p => !p),
            j: () => set_recording(r => !r),
            k: () => {
                if (!video_loop.current) return
                set_loop_rate(Math.max(0.1, loop_rate - 0.1))
            },
            l: () => {
                if (!video_loop.current) return
                set_loop_rate(Math.min(14, loop_rate + 0.1))
            },

        }
    }, [
        display_stream, cam_stream,
        video_loop, loop_rate
    ])

    useEffect(() => {
        if (!video_display.current || !video_cam.current || !video_loop.current) return

        const handler = (evt: KeyboardEvent) => {

            if (key_binding[evt.key.toLowerCase()]) {
                key_binding[evt.key]()
            }
        }

        document.addEventListener('keydown', handler)
        return () => {
            document.removeEventListener('keydown', handler)
        }
    },)

    const bind_midi = useCallback(() => {

        console.debug("wuuw")
        navigator.permissions.query({
            name: 'midi' as PermissionName
        }).then((res) => {
            if (res.state == 'granted') {
                console.debug("wuuw")
                navigator.requestMIDIAccess().then((midi_access) => {
                    console.debug("asdfsdf", midi_access)
                })
            }else{
                console.debug("Asdfs--", res.state)
            }
        })
    }, [])

    return (
        <>
            <video ref={video_cam}
                muted autoPlay loop
                preload='auto' onResize={(evt) => {
                    const vid = evt.target as HTMLVideoElement
                    const [w, h] = resize_video(vid.videoWidth, vid.videoHeight)
                    vid.width = w
                    vid.height = h
                }}></video>
            <video ref={video_display}
                muted autoPlay loop
                preload='auto' onResize={(evt) => {
                    const vid = evt.target as HTMLVideoElement
                    const [w, h] = resize_video(vid.videoWidth, vid.videoHeight)
                    vid.width = w
                    vid.height = h
                }}></video>
            <video ref={video_loop}
                muted autoPlay loop
                preload='auto' onResize={(evt) => {
                    const vid = evt.target as HTMLVideoElement
                    const [w, h] = resize_video(vid.videoWidth, vid.videoHeight)
                    vid.width = w
                    vid.height = h
                }}></video>

            <div>
                <canvas ref={output_canvas}></canvas>
            </div>
            <div>
                <div>
                    <label htmlFor="">source:</label>
                    <button className={selected_source == 'display' ? 'active' : undefined}
                        onClick={select_display_media}
                    >screen share</button>
                    <button className={selected_source == 'cam' ? 'active' : undefined}
                        onClick={select_camera_media}
                    >cam</button>
                    <button className={selected_source == 'loop' ? 'active' : undefined}
                        onClick={select_loop}
                    >loop</button>
                </div>
                <div>
                    <button
                        onClick={() => set_playing(p => !p)}
                    >{playing ? 'pause' : 'play'}</button>
                    <button
                        onClick={() => set_recording(!recording)}
                    >{recording ? 'stop recording' : 'record'}</button>
                </div>
                <div>
                    <label htmlFor="">loop rate</label>
                    <input type="range" min={0.1} max={14} step={0.1}
                        value={loop_rate}
                        onChange={(evt) => {
                            const rate = Number(evt.target.value)
                            set_loop_rate(rate)
                        }}
                    />
                </div>
                <div>
                    <button disabled onClick={bind_midi}>
                        bind midi
                    </button>
                </div>
            </div>
        </>
    )
}

render(<App></App>, document.querySelector("#app"))
