import { render } from 'react-dom'
import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import React from 'react'

import { SiMidi, SiSpeedtest } from "react-icons/si";
import { MdOutlineScreenShare, MdLoop, MdStopCircle, MdPause, MdFiberManualRecord } from "react-icons/md";
import { LuWebcam } from "react-icons/lu";
import { FaPlay, FaReadme, FaWindowMinimize } from "react-icons/fa";


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

    const [midi_access, set_midi_access] = useState<WebMidi.MIDIAccess>()
    const [is_midi_binding, set_is_midi_binding] = useState(false)
    const [toggle_midi_flags, set_toggle_midi_flags] = useState({
        recording: 0,
        playing: false
    })

    type midi_msg = {
        type: 'noteoff' | 'noteon',
        id: string,
        note: number
    } | {
        type: 'cc',
        id: string,
        control_number: number,
        value: number
    } | undefined


    type midi_id = string
    type midi_note = number
    type midi_controler_number = number
    type midi_controler_value = number
    type midi_binding_key =
        `${midi_id}-${'noteon' | 'noteoff'}-${midi_note}` |
        `${midi_id}-${'cc'}-${midi_controler_number}`

    type function_to_bind = 'cam' | 'display' | 'loop' |
        'toggle-play' | 'toggle-record' |
        'rate'
    const [midi_binding, set_midi_binding] = useState<{
        [key: midi_binding_key]: function_to_bind
    }>({})

    const [function_to_bind, set_function_to_bind] = useState<function_to_bind>()

    const animate_ref = useRef<number>()

    const [logs, set_logs] = useState<{ level: 'info' | 'error', text: string }>({ level: 'info', text: 'select a source' })

    const [show_info, set_show_info] = useState(false)

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

        const vid = video_cam.current
        window.addEventListener('resize', () => {
            const [w, h] = resize_video(vid.videoWidth, vid.videoHeight)
            vid.width = w
            vid.height = h
        })


        video_cam.current.srcObject = cam_stream
        video_cam.current.play()

    }, [video_cam, cam_stream])

    useEffect(() => {
        // set video source for display streaming
        if (!video_display.current || !display_stream) return

        const vid = video_display.current
        window.addEventListener('resize', () => {
            const [w, h] = resize_video(vid.videoWidth, vid.videoHeight)
            vid.width = w
            vid.height = h
        })

        video_display.current.srcObject = display_stream
        video_display.current.play()

    }, [video_display, display_stream])

    const select_display_media = useCallback(() => {
        if (display_stream) {
            set_selected_source('display')
            set_playing(true)

            set_logs({
                level: 'info',
                text: 'playing screen share source'
            })
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

            set_logs({
                level: 'info',
                text: 'playing screen share source'
            })
        }).catch((err) => {
            console.error(err)
            set_logs({
                level: 'error',
                text: 'error while trying to use screen share'
            })
        })

    }, [display_stream])

    const select_camera_media = useCallback(() => {
        if (cam_stream) {
            set_selected_source('cam')
            set_playing(true)
            set_logs({
                level: 'info',
                text: 'playing cam source'
            })

            return
        }

        navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false
        }).then((media_stream) => {
            set_cam_stream(media_stream)
            set_selected_source('cam')
            set_playing(true)

            set_logs({
                level: 'info',
                text: 'playing cam source'
            })
        }).catch((err) => {
            console.error(err)
            set_logs({
                level: 'error',
                text: 'error while trying to use cam'
            })
        })

    }, [cam_stream])

    const select_loop = useCallback(() => {

        set_logs({
            level: 'info',
            text: 'playing loop source'
        })


        if (!loop_src) {
            set_logs({
                level: 'info',
                text: 'record a loop first'
            })
        }

        set_selected_source('loop')
        set_playing(true)


    }, [loop_src])

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
        //ctx.globalCompositeOperation = 'source-in';
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

        output_canvas.current.width = window.innerWidth
        output_canvas.current.height = window.innerHeight

        window.addEventListener('resize', () => {
            output_canvas.current.width = window.innerWidth
            output_canvas.current.height = window.innerHeight
        })

        set_ctx(output_canvas.current.getContext('2d'))

    }, [output_canvas])

    useEffect(() => {
        if (!video_loop.current) return

        video_loop.current.src = loop_src
        video_loop.current.play().then(() => {
            video_loop.current.pause()
            video_loop.current.playbackRate = loop_rate
            video_loop.current.play()
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

            h: () => set_show_info(f => !f),

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
        if (midi_access) set_is_midi_binding(true)

        console.info("binding midi")

        navigator.permissions.query({
            name: 'midi' as PermissionName
        }).then((res) => {
            if (res.state == 'granted') {
                navigator.requestMIDIAccess().then((midi_access) => {
                    set_midi_access(midi_access)
                    set_is_midi_binding(true)
                })
            } else {
                console.error(res.state)
                set_logs({
                    level: 'error',
                    text: 'midi permission not granted'
                })
            }
        })
    }, [midi_access])

    const midi_handler = useCallback((msg: WebMidi.MIDIMessageEvent) => {


        const midi_id = (msg.target as MIDIInput).id
        const status_byte = msg.data[0]

        const msg_type_flag = status_byte >> 4;

        let midi_msg: midi_msg
        switch (msg_type_flag) {
            case 8:

                midi_msg = {
                    id: midi_id,
                    type: 'noteoff',
                    note: msg.data[1]
                }
                break
            case 9:
                if (msg.data[2] == 0) {
                    midi_msg = {
                        id: midi_id,
                        type: 'noteoff',
                        note: msg.data[1]
                    }
                } else {
                    midi_msg = {
                        id: midi_id,
                        type: 'noteon',
                        note: msg.data[1]
                    }
                }

                break
            case 11:
                midi_msg = {
                    id: midi_id,
                    type: 'cc',
                    control_number: msg.data[1],
                    value: msg.data[2]
                }
                break
            default:
                return
        }

        console.debug(midi_msg, 'msg')


        if (!function_to_bind) {

            let midi_action: function_to_bind

            let value: number
            if (midi_msg.type == 'noteon' || midi_msg.type == 'noteoff') {
                midi_action = midi_binding[`${midi_msg.id}-noteon-${(midi_msg as { type: 'noteon', note: number, id: string }).note}`]

            } else {
                midi_action = midi_binding[`${midi_msg.id}-cc-${(midi_msg as { type: 'cc', control_number: number, id: string }).control_number}`]
                value = (midi_msg as { type: 'cc', control_number: number, id: string, value: number }).value
            }

            switch (midi_action) {
                case 'display':
                    if (value == undefined || value == 127) select_display_media()
                    break

                case 'cam':
                    if (value == undefined || value == 127) select_camera_media()
                    break

                case 'loop':
                    if (value == undefined || value == 127) select_loop()
                    break
                case 'toggle-play':
                    if (value == undefined || value == 127 && midi_msg.type == 'noteoff') set_playing(p => !p)
                    break
                case 'toggle-record':
                    if (midi_msg.type == 'noteon') {

                        set_recording(toggle_midi_flags.recording <= 1)
                        console.debug(toggle_midi_flags.recording > 1, 'toggle recording flag')
                        set_toggle_midi_flags(r => ({ ...r, ...{ recording: (toggle_midi_flags.recording + 1) % 3 } }))
                    }
                    if (value != undefined) {
                        set_recording( value == 127)
                        set_toggle_midi_flags(r => ({
                            ...r,
                            ...{ recording: 0 }
                        }))
                    }
                    break
                case 'rate':
                    if (!isNaN(value)) set_loop_rate((value % 127))
                    break

                default:
                    break
            }
            return
        }


        if (midi_msg.type == 'cc') {

            set_midi_binding(mb => ({
                ...mb,
                ...{
                    [`${midi_msg.id}-cc-${(midi_msg as { type: 'cc', control_number: number, id: string }).control_number}`]: function_to_bind
                }
            }))
        } else {
            set_midi_binding(mb => ({
                ...mb,
                ...{
                    [`${midi_msg.id}-noteon-${(midi_msg as { type: 'noteon', note: number, id: string }).note}`]: function_to_bind
                }
            }))
        }


        set_is_midi_binding(false)
        set_function_to_bind(undefined)

        return

    }, [
        is_midi_binding, function_to_bind, midi_binding,
        display_stream, cam_stream, loop_src,
        toggle_midi_flags
    ])


    useEffect(() => {
        if (!midi_access) return

        for (let [id, input] of midi_access.inputs) {
            input.addEventListener('midimessage', midi_handler)
        }

        return () => {
            for (let [id, input] of midi_access.inputs) {
                input.removeEventListener('midimessage', midi_handler)
            }

        }
    }, [
        midi_access,
        is_midi_binding, function_to_bind, midi_binding,
        display_stream, cam_stream, loop_src,
        toggle_midi_flags
    ])

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
            <canvas ref={output_canvas}></canvas>
            {
                show_info ?
                    <div id="info">
                        <div>
                            <h1>Video Looper</h1><FaWindowMinimize onClick={() => set_show_info(false)} />
                        </div>
                        <h2>Select capture stream</h2>
                        <span>choose between capturing video from screen sharing a window <MdOutlineScreenShare /> or a webcam <LuWebcam />.</span>

                        <h2>Record short segment</h2>
                        <span>Start recording a loop by clicking the record <MdFiberManualRecord />/ stop <MdStopCircle /> button.</span>

                        <h2>Preview recorded loop</h2>
                        <span>To preview loop segment, click on <MdLoop />, adjust video playback rate to desired<SiSpeedtest />.</span>

                        <h2>Attach a midi device </h2>
                        <span>Attach a devices using <SiMidi /> button.</span>
                        <span>Click on the function to attach to, using the midi controller.</span>

                    </div> : null
            }
            <div id="menu" className={cam_stream || display_stream ? 'dissapear' : ''}>
                <MdOutlineScreenShare className={
                    `${selected_source == 'display' ? 'active' : ''} ${function_to_bind == 'display' ? 'binding' : ''}`
                }
                    onClick={(evt) => {
                        if (is_midi_binding) {
                            set_function_to_bind('display')
                            return
                        }
                        select_display_media()
                    }}
                    title='screen share (a).'
                />
                <LuWebcam
                    className={
                        `${selected_source == 'cam' ? 'active' : ''} ${function_to_bind == 'cam' ? 'binding' : ''}`
                    }
                    onClick={() => {
                        if (is_midi_binding) {
                            set_function_to_bind('cam')
                            return
                        }
                        select_camera_media()
                    }}
                    title='camera source (s).'
                />
                <MdLoop
                    className={
                        `${selected_source == 'loop' ? 'active' : ''} ${function_to_bind == 'loop' ? 'binding' : ''}`
                    }
                    onClick={() => {
                        if (is_midi_binding) {
                            set_function_to_bind('loop')
                            return
                        }
                        select_loop()
                    }}
                    title='loop source (d).'
                />

                <FaPlay
                    className={function_to_bind == 'toggle-play' ? 'binding' : ''}
                    onClick={() => {
                        if (is_midi_binding) {
                            set_function_to_bind('toggle-play')
                            return
                        }
                        set_playing(p => !p)
                    }}
                    style={{ display: playing ? 'none' : '' }}
                    title='play (space)'
                />

                <MdPause
                    className={function_to_bind == 'toggle-play' ? 'binding' : ''}
                    onClick={() => {
                        if (is_midi_binding) {
                            set_function_to_bind('toggle-play')
                            return
                        }
                        set_playing(p => !p)
                    }}
                    style={{ display: !playing ? 'none' : '' }}
                    title='stop (space)'
                />

                <MdFiberManualRecord
                    className={function_to_bind == 'toggle-record' ? 'binding' : ''}
                    onClick={() => {
                        console.debug("recording", is_midi_binding)
                        if (is_midi_binding) {
                            set_function_to_bind('toggle-record')
                            return
                        }
                        set_recording(!recording)
                    }}
                    style={{ display: recording ? 'none' : '' }}
                    title='record a loop (j)'
                />

                <MdStopCircle
                    className={function_to_bind == 'toggle-record' ? 'binding' : ''}
                    onClick={() => {
                        if (is_midi_binding) {
                            set_function_to_bind('toggle-record')
                            return
                        }
                        set_recording(!recording)
                    }}
                    style={{ display: !recording ? 'none' : '' }}
                    title='stop recording loop (j)'
                />

                <div>
                    <SiSpeedtest
                        className={function_to_bind == 'rate' ? 'binding' : ''}
                        onClick={() => {
                            if (is_midi_binding) {
                                set_function_to_bind('rate')
                                return
                            }
                            set_loop_rate(1)
                        }}
                        title='loop playback rate'
                    />
                    <input type="range" min={0.1} max={14} step={0.1}
                        value={loop_rate}
                        onChange={(evt) => {
                            const rate = Number(evt.target.value)
                            set_loop_rate(rate)
                        }}
                    />
                </div>

                <SiMidi
                    className={is_midi_binding ? 'active' : ''}
                    title='attach midi (p)'
                    onClick={() => {
                        if (is_midi_binding) {
                            set_is_midi_binding(false)
                            set_function_to_bind(undefined)
                            return
                        }
                        bind_midi()
                    }}
                />
                <FaReadme
                    title='readme'
                    onClick={() => set_show_info(f => !f)}
                />
            </div >
        </>
    )
}

render(<App></App>, document.querySelector("#app"))
