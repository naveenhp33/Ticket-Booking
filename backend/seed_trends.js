const mongoose = require('mongoose');
const Ticket = require('./models/Ticket.model');
const User = require('./models/User.model');
require('dotenv').config();

const seedTrends = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        const admin = await User.findOne({ email: 'admin@vdartinc.com' });
        const user = await User.findOne({ email: 'user@vdartinc.com' });
        const agents = await User.find({ role: 'support_agent' });

        if (!admin || !user || agents.length === 0) {
            console.error('Core users missing.');
            process.exit(1);
        }

        console.log('Cleaning old sample trends...');
        await Ticket.deleteMany({ title: /Sample Trend/ });

        console.log('Seeding last 7 days of ticket data...');
        const now = new Date();
        let total = 0;

        for (let i = 0; i < 7; i++) {
            const date = new Date();
            date.setDate(now.getDate() - i);
            const count = Math.floor(Math.random() * 4) + 3; // 3-6 tickets per day
            
            for (let j = 0; j < count; j++) {
                const status = Math.random() > 0.4 ? 'resolved' : 'open';
                const priority = ['low', 'medium', 'high', 'critical'][Math.floor(Math.random() * 4)];
                const agent = agents[Math.floor(Math.random() * agents.length)];
                
                const ticketDate = new Date(date);
                ticketDate.setHours(Math.floor(Math.random() * 24), Math.floor(Math.random() * 60));

                const ticket = new Ticket({
                    title: `Sample Trend Ticket ${i}-${j}`,
                    description: 'Automated sample ticket for dashboard visualization.',
                    status: status,
                    priority: priority,
                    category: 'IT',
                    department: 'IT',
                    createdBy: user._id,
                    assignedTo: agent._id,
                    createdAt: ticketDate,
                    updatedAt: ticketDate
                });

                ticket.statusHistory = [{ from: 'open', to: 'assigned', timestamp: ticketDate, reason: 'Auto-assigned' }];

                if (status === 'resolved') {
                    const resolvedAt = new Date(ticketDate);
                    resolvedAt.setHours(resolvedAt.getHours() + Math.floor(Math.random() * 5) + 1);
                    ticket.resolution = {
                        notes: 'Resolved automatically in seed.',
                        resolvedAt: resolvedAt,
                        resolvedBy: agent._id
                    };
                    ticket.statusHistory.push({ from: 'assigned', to: 'resolved', timestamp: resolvedAt, reason: 'Final resolution' });
                }

                await ticket.save();
                total++;
            }
        }

        console.log(`Successfully seeded ${total} tickets!`);
        process.exit(0);
    } catch (err) {
        console.error('Seeding error:', err);
        process.exit(1);
    }
};

seedTrends();
