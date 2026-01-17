import React, { useEffect, useState } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import './CustomDatePicker.css';

interface CustomDatePickerProps {
    selected: Date | null;
    onChange: (date: Date | null) => void;
    placeholderText?: string;
    minDate?: Date;
    maxDate?: Date;
    disabled?: boolean;
}

const CustomDatePicker: React.FC<CustomDatePickerProps> = ({
    selected,
    onChange,
    placeholderText = 'Select date',
    minDate,
    maxDate,
    disabled = false,
}) => {
    const [isDarkMode, setIsDarkMode] = useState(false);

    // Detect dark mode
    useEffect(() => {
        const checkDarkMode = () => {
            const darkModeEnabled =
                document.documentElement.classList.contains('dark') ||
                window.matchMedia('(prefers-color-scheme: dark)').matches;
            setIsDarkMode(darkModeEnabled);
        };

        checkDarkMode();

        // Watch for changes
        const observer = new MutationObserver(checkDarkMode);
        observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['class'],
        });

        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        mediaQuery.addEventListener('change', checkDarkMode);

        return () => {
            observer.disconnect();
            mediaQuery.removeEventListener('change', checkDarkMode);
        };
    }, []);

    // Minimal header matching Figma design
    const CustomHeader = ({
        date,
        decreaseMonth,
        increaseMonth,
        prevMonthButtonDisabled,
        nextMonthButtonDisabled,
    }: any) => {
        const months = [
            "January", "February", "March", "April", "May", "June",
            "July", "August", "September", "October", "November", "December"
        ];

        return (
            <div className="figma-calendar-header">
                <button
                    type="button"
                    onClick={decreaseMonth}
                    disabled={prevMonthButtonDisabled}
                    className="figma-nav-button"
                    aria-label="Previous month"
                >
                    <ChevronLeft className="w-4 h-4" />
                </button>
                <div className="figma-header-text">
                    {months[date.getMonth()]} {date.getFullYear()}
                </div>
                <button
                    type="button"
                    onClick={increaseMonth}
                    disabled={nextMonthButtonDisabled}
                    className="figma-nav-button"
                    aria-label="Next month"
                >
                    <ChevronRight className="w-4 h-4" />
                </button>
            </div>
        );
    };

    return (
        <div className={`figma-datepicker-wrapper ${isDarkMode ? 'dark-mode' : 'light-mode'}`}>
            <div className="relative">
                <DatePicker
                    selected={selected}
                    onChange={onChange}
                    minDate={minDate}
                    maxDate={maxDate}
                    disabled={disabled}
                    placeholderText={placeholderText}
                    dateFormat="MMM dd, yyyy"
                    className="figma-datepicker-input"
                    calendarClassName="figma-calendar"
                    showPopperArrow={false}
                    autoComplete="off"
                    renderCustomHeader={CustomHeader}
                />
            </div>
        </div>
    );
};

export default CustomDatePicker;
