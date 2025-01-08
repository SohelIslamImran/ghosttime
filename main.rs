use std::{
    io::stdout,
    sync::mpsc::{self, Receiver, Sender},
    thread,
    time::SystemTime,
};

use animation::FRAMES;
use crossterm::event::{Event, KeyCode};
use ratatui::{
    layout::{Constraint, Direction, Flex, Layout},
    prelude::CrosstermBackend,
    Terminal,
};

mod animation;

fn main() {
    let _wrapper = alternate_screen_wrapper::AlternateScreen::enter().unwrap();
    let (tx, rx): (Sender<()>, Receiver<()>) = mpsc::channel();

    thread::spawn(move || loop {
        key_press(&tx);
    });

    {
        let vertical_center = Layout::new(
            Direction::Vertical,
            [Constraint::Length(animation::IMAGE_HEIGHT)],
        )
        .flex(Flex::Center);
        let horizontal_center = Layout::new(
            Direction::Horizontal,
            [Constraint::Length(animation::IMAGE_WIDTH)],
        )
        .flex(Flex::Center);

        let mut terminal = Terminal::new(CrosstermBackend::new(stdout())).unwrap();
        let start = SystemTime::now();
        const MICROS_PER_FRAME: u128 = 30_000;

        loop {
            if let Ok(_should_quit) = rx.try_recv() {
                break;
            }
            // Automatically skip frames when render is slow
            let i = (start.elapsed().unwrap().as_micros() / MICROS_PER_FRAME) as usize;
            let frame = &FRAMES[i % FRAMES.len()];
            terminal
                .draw(|f| {
                    let area = horizontal_center.split(vertical_center.split(f.area())[0])[0];
                    f.render_widget(frame, area);
                })
                .unwrap();

            std::thread::sleep(std::time::Duration::from_micros(MICROS_PER_FRAME.try_into().unwrap()));
        }
    }
}

fn key_press(tx: &Sender<()>) {
    loop {
        if let Event::Key(key) = crossterm::event::read().unwrap() {
            if key.code == KeyCode::Char('q') {
                tx.send(()).unwrap();
            }
        }
    }
}